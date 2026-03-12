const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Recursively copy directory (excluding unnecessary files)
 */
function copyDir(src, dest, options = {}) {
    if (!fs.existsSync(src)) {
        console.warn(`Warning: Source directory does not exist: ${src}`);
        return;
    }

    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const files = fs.readdirSync(src);
    for (const file of files) {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        
        const stat = fs.statSync(srcPath);
        
        if (stat.isDirectory()) {
            // Skip unnecessary directories
            if (options.skipMcpDirs && (file === '__pycache__' || file === '.venv' || file === '.pytest_cache')) {
                continue;
            }
            copyDir(srcPath, destPath, options);
        } else {
            // Skip unnecessary files
            if (options.skipMcpFiles && (file.endsWith('.log') || file.endsWith('.pyc') || file === 'uv.lock')) {
                continue;
            }
            // Skip TypeScript files as they will be compiled by tsc
            if (options.skipTsFiles && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
                continue;
            }
            
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * Read dependency information from source directory
 */
function readDependenciesFromSource(sourceDir) {
    const sourcePyprojectPath = path.join(sourceDir, 'pyproject.toml');
    const sourceRequirementsPath = path.join(sourceDir, 'requirements.txt');
    
    let dependencies = [];
    let requiresPython = ">=3.10";
    
    // Read pyproject.toml first
    if (fs.existsSync(sourcePyprojectPath)) {
        try {
            const content = fs.readFileSync(sourcePyprojectPath, 'utf8');
            console.log('Reading dependency information from pyproject.toml...');
            
            // Parse requires-python
            const pythonMatch = content.match(/requires-python\s*=\s*"([^"]+)"/);
            if (pythonMatch) {
                requiresPython = pythonMatch[1];
            }
            
            // Parse dependencies array
            const depsMatch = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
            if (depsMatch) {
                const depsContent = depsMatch[1];
                // Extract each dependency, remove quotes and commas
                dependencies = depsContent
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.startsWith('"'))
                    .map(line => line.replace(/^"|"[,]*$/g, ''))
                    .filter(dep => dep.length > 0);
            }
        } catch (error) {
            console.warn('Failed to parse pyproject.toml, trying to read requirements.txt:', error.message);
        }
    }
    
    // If pyproject.toml parsing failed, read requirements.txt
    if (dependencies.length === 0 && fs.existsSync(sourceRequirementsPath)) {
        try {
            const content = fs.readFileSync(sourceRequirementsPath, 'utf8');
            console.log('Reading dependency information from requirements.txt...');
            
            dependencies = content
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0 && !line.startsWith('#'))
                .filter(dep => dep.length > 0);
        } catch (error) {
            console.warn('Failed to read requirements.txt:', error.message);
        }
    }
    
    // If both failed, use default dependencies based on common MCP server requirements
    if (dependencies.length === 0) {
        console.warn('Unable to read source dependencies, using default dependency list');
        dependencies = [
            "psutil",
            "mcp",
            "selenium>=4.0.0",
            "appium-python-client>=2.0.0",
            "behave>=1.2.6"
        ];
    }
    
    // console.log(`Found ${dependencies.length} dependencies:`, dependencies);
    return { dependencies, requiresPython };
}

/**
 * Generate pyproject.toml suitable for extension use
 */
function generatePyprojectToml(targetDir, sourceDir, serverConfig) {
    const { dependencies, requiresPython } = readDependenciesFromSource(sourceDir);
    
    // Format dependency list to TOML format
    const formattedDependencies = dependencies
        .map(dep => `    "${dep}"`)
        .join(',\n');
    
    const pyprojectContent = `[project]
name = "${serverConfig.projectName}"
version = "0.1.0"
description = "${serverConfig.description}"
requires-python = "${requiresPython}"
dependencies = [
${formattedDependencies}
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["."]

[tool.uv]
dev-dependencies = []
`;

    const pyprojectPath = path.join(targetDir, 'pyproject.toml');
    fs.writeFileSync(pyprojectPath, pyprojectContent, 'utf8');
    console.log(`Generated: ${path.relative(process.cwd(), pyprojectPath)}`);
}

/**
 * Process appium_conf.json to remove sensitive information
 */
function processAppiumConfig(targetDir) {
    const appiumConfigPath = path.join(targetDir, 'conf', 'appium_conf.json');
    
    if (fs.existsSync(appiumConfigPath)) {
        try {
            console.log('Processing appium_conf.json to remove sensitive information...');
            
            // Read the JSON file
            const configContent = fs.readFileSync(appiumConfigPath, 'utf8');
            const config = JSON.parse(configContent);
            
            // Process each driver configuration
            if (config.APPIUM_DRIVER_CONFIGS) {
                Object.keys(config.APPIUM_DRIVER_CONFIGS).forEach(platform => {
                    const driverConfig = config.APPIUM_DRIVER_CONFIGS[platform];
                    
                    // Clear sensitive information from bstack:options
                    if (driverConfig['bstack:options']) {
                        if (driverConfig['bstack:options'].userName) {
                            driverConfig['bstack:options'].userName = "";
                        }
                        if (driverConfig['bstack:options'].accessKey) {
                            driverConfig['bstack:options'].accessKey = "";
                        }
                    }
                });
            }
            
            // Write back the cleaned configuration
            const cleanedContent = JSON.stringify(config, null, 2);
            fs.writeFileSync(appiumConfigPath, cleanedContent, 'utf8');
            
            console.log('✅ appium_conf.json processed successfully - sensitive information removed');
        } catch (error) {
            console.warn('⚠️  Failed to process appium_conf.json:', error.message);
        }
    } else {
        console.warn('⚠️  appium_conf.json not found, skipping processing');
    }
}

/**
 * Copy and configure a single MCP server
 */
function copyMcpServer(serverConfig) {
    const { sourceDir, targetDirName, projectName, description } = serverConfig;
    const absoluteSourceDir = path.join(__dirname, '..', '..', sourceDir);
    const targetDir = path.join(__dirname, '..', 'out', 'resources', targetDirName);
    
    console.log(`Copying MCP server files from ${sourceDir}...`);
    
    if (fs.existsSync(absoluteSourceDir)) {
        // Clean target directory
        if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true, force: true });
        }
        
        // Copy MCP server files
        console.log(`Copying from ${path.relative(process.cwd(), absoluteSourceDir)} to ${path.relative(process.cwd(), targetDir)}`);
        copyDir(absoluteSourceDir, targetDir, { skipMcpDirs: true, skipMcpFiles: true });
        
        // Process appium_conf.json to remove sensitive information
        if (projectName === 'bdd-appium-mcp-server') {
            processAppiumConfig(targetDir);
        }
        
        // Generate pyproject.toml with server-specific configuration
        generatePyprojectToml(targetDir, absoluteSourceDir, { projectName, description });
        
        console.log(`✅ ${projectName} files copied successfully`);
        return true;
    } else {
        console.warn(`⚠️  ${sourceDir} directory does not exist, skipping ${projectName} copy`);
        return false;
    }
}

/**
 * Main compilation function
 */
function compile() {
    console.log('Starting extension compilation...');
    
    try {
        // 1. Run TypeScript compilation
        console.log('Running TypeScript compilation...');
        execSync('tsc -p ./', { stdio: 'inherit' });
        
        // 2. Copy resources files (excluding mcp-server)
        console.log('Copying resources files...');
        const srcResources = path.join(__dirname, '..', 'resources');
        const destResources = path.join(__dirname, '..', 'out', 'resources');
        
        if (fs.existsSync(srcResources)) {
            const files = fs.readdirSync(srcResources);
            for (const file of files) {
                // Skip mcp-server directory as we will copy directly from pywinauto-mcp-server
                if (file === 'mcp-server') {
                    continue;
                }
                
                const srcPath = path.join(srcResources, file);
                const destPath = path.join(destResources, file);
                
                if (!fs.existsSync(destResources)) {
                    fs.mkdirSync(destResources, { recursive: true });
                }
                
                const stat = fs.statSync(srcPath);
                if (stat.isDirectory()) {
                    copyDir(srcPath, destPath, { skipTsFiles: true });
                } else {
                    // Skip TypeScript files
                    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) {
                        fs.copyFileSync(srcPath, destPath);
                    }
                }
            }
            console.log('✅ Resources files copied successfully');
        } else {
            console.warn('⚠️  Resources directory does not exist, skipping copy');
        }
        
        // 3. Copy MCP server files from multiple sources
        console.log('Copying MCP server files...');
        
        // Define MCP server configurations
        const mcpServers = [
            {
                sourceDir: 'pywinauto-mcp-server',
                targetDirName: 'pywinauto-mcp-server',
                projectName: 'bdd-pywinauto-mcp-server',
                description: 'MCP Server for Windows Browser Automation - BDD AI Toolkit'
            },
            {
                sourceDir: 'appium-mcp-server',
                targetDirName: 'appium-mcp-server',
                projectName: 'bdd-appium-mcp-server',
                description: 'MCP Server for Appium Automation - BDD AI Toolkit'
            }
        ];
        
        // Copy each MCP server
        let successCount = 0;
        for (const serverConfig of mcpServers) {
            if (copyMcpServer(serverConfig)) {
                successCount++;
            }
        }
        
        if (successCount > 0) {
            console.log(`✅ ${successCount} MCP Server(s) copied successfully`);
        } else {
            console.warn('⚠️  No MCP servers were copied');
        }
        
        console.log('✅ Compilation completed!');
        
    } catch (error) {
        console.error('❌ Compilation failed:', error.message);
        process.exit(1);
    }
}

// Run compilation
if (require.main === module) {
    compile();
}

module.exports = { compile, copyDir, readDependenciesFromSource, generatePyprojectToml, copyMcpServer };
