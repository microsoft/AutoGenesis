// Acquire VS Code API
declare function acquireVsCodeApi(): {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
};

const vscode = acquireVsCodeApi();

// Type definitions for messages
interface VSCodeMessage {
    command: 'environmentStatus' | 'platformInfo' | 'installationStatus' | 'statusMessage' | 'showCheckingEnvironment' | 'pythonRequirementsInstallationStatus' | 'mcpServerSetup' | 'mcpSetupProgress' | 'mcpStatusUpdate';
    status?: 'installing' | 'done' | 'error' | 'macos' | 'success' | 'starting' | 'cloning' | 'launching' | 'running';
    tool?: string;
    environmentStatus?: EnvironmentStatus;
    mcpServerStatus?: McpServerStatus;
    message?: string;
    apiKey?: string;
    step?: string;
    progress?: number;
    source?: 'auto' | 'user' | 'autoResolveComplete'; // Source of environment status check
}

/**
 * MCP server status interface
 */
interface McpServerStatus {
    status: 'none' | 'complete' | 'update_available';
    serverName?: string;
    message: string;
    needsUserAction: boolean;
}

/**
 * Environment status indicators
 */
interface EnvironmentStatus {
    npm: boolean;
    code: boolean;
    python: boolean;
    uv: boolean;
    dotnetSdk: boolean;
    pythonVersion?: string;
    pythonError?: string;
    pythonDetailedError?: string;
    pythonInstallationGuidance?: string;
    pythonFoundVersions?: Array<{ command: string; version: string; isCompatible: boolean }>;
    allReady: boolean;
    // New fields for resolve button logic
    canAutoResolve: boolean; // True if we can auto-resolve some issues (cli/uv)
    manualInstallNeeded: string[]; // List of tools that need manual installation (npm/python)
    autoResolveNeeded: string[]; // List of tools that can be auto-resolved (cli/uv)
}

// Track if initial environment check has completed
let initialEnvironmentCheckCompleted = false;
let isEnvironmentCheckInProgress = false;

/**
 * Show Python installation guidance in a modal dialog
 */
function showPythonInstallationGuidance(
    guidance: string, 
    foundVersions?: Array<{ command: string; version: string; isCompatible: boolean }>
): void {
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-widget-border);
        border-radius: 6px;
        max-width: 80%;
        max-height: 80%;
        overflow-y: auto;
        padding: 20px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;

    // Create modal header
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        border-bottom: 1px solid var(--vscode-widget-border);
        padding-bottom: 10px;
    `;

    const title = document.createElement('h2');
    title.textContent = '🐍 Python Installation Guide';
    title.style.cssText = `
        margin: 0;
        color: var(--vscode-foreground);
        font-size: 1.2em;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.style.cssText = `
        background: none;
        border: none;
        color: var(--vscode-foreground);
        font-size: 1.2em;
        cursor: pointer;
        padding: 5px;
        border-radius: 3px;
    `;
    closeButton.onmouseover = () => closeButton.style.backgroundColor = 'var(--vscode-toolbar-hoverBackground)';
    closeButton.onmouseout = () => closeButton.style.backgroundColor = 'transparent';

    header.appendChild(title);
    header.appendChild(closeButton);

    // Create modal body
    const body = document.createElement('div');
    const guidanceLines = guidance.split('\n');
    
    guidanceLines.forEach(line => {
        const p = document.createElement('p');
        p.style.cssText = `
            margin: 5px 0;
            color: var(--vscode-foreground);
            line-height: 1.4;
        `;
        
        if (line.startsWith('📋') || line.startsWith('🪟') || line.startsWith('🍎') || line.startsWith('🐧') || line.startsWith('🔄')) {
            p.style.fontWeight = 'bold';
            p.style.color = 'var(--vscode-textLink-foreground)';
            p.style.marginTop = '15px';
        } else if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
            p.style.marginLeft = '20px';
            p.style.fontFamily = 'var(--vscode-editor-font-family)';
        } else if (line.includes(':')) {
            p.style.fontFamily = 'var(--vscode-editor-font-family)';
        }
        
        p.textContent = line;
        body.appendChild(p);
    });

    modalContent.appendChild(header);
    modalContent.appendChild(body);
    modalOverlay.appendChild(modalContent);

    // Close modal functionality
    const closeModal = () => {
        document.body.removeChild(modalOverlay);
    };

    closeButton.onclick = closeModal;
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    };

    // Add to document
    document.body.appendChild(modalOverlay);

    // Focus on close button for accessibility
    closeButton.focus();
}

// Determine if running on macOS and add class to body for conditional CSS
document.addEventListener('DOMContentLoaded', () => {
    // Initially disable buttons until environment check completes
    disableButtonsUntilEnvironmentCheck();

    // **NEW: Initially show overlay on all sections except env-status-section since environment is not yet confirmed**
    showInitialOverlayOnAllSections();

    // Show checking environment UI
    showCheckingEnvironmentUI();

    // Send a message to request environment status
    vscode.postMessage({
        command: 'checkEnvironment'
    });

    // Check if this is running on macOS (the extension will tell us)
    vscode.postMessage({
        command: 'checkPlatform'
    });
});

// Message handler
window.addEventListener('message', event => {
    const message = event.data as VSCodeMessage;
    
    if (message.command === 'environmentStatus' && message.environmentStatus) {
        // Hide checking environment UI
        hideCheckingEnvironmentUI();

        updateEnvironmentStatus(message.environmentStatus);

        // Mark that initial environment check has completed
        if (!initialEnvironmentCheckCompleted) {
            initialEnvironmentCheckCompleted = true;
            enableButtonsAfterEnvironmentCheck(message.environmentStatus.allReady);
        }

        // Reset resolve button state only if it was in resolving or checking state
        // AND this is from auto-resolve completion
        const resolveButton = document.getElementById('resolveEnvIssues') as HTMLButtonElement;
        
        if (resolveButton && 
            (resolveButton.classList.contains('resolving') || resolveButton.classList.contains('checking')) &&
            message.source === 'autoResolveComplete') {
            resetResolveButtonState();
        }    } else if (message.command === 'platformInfo') {
        // Update body class for platform-specific styling
        if (message.status === 'macos') {
            document.body.classList.add('is-macos');
            document.body.classList.remove('is-windows');
            
            // Update resolve button text for macOS
            const resolveButton = document.querySelector('#resolveEnvIssues .button-title');
            if (resolveButton) {
                resolveButton.textContent = 'Auto Resolve All Issues';
            }
            
            // Update MCP server icon for macOS
            const mcpServerIcon = document.getElementById('mcp-server-icon');
            if (mcpServerIcon) {
                mcpServerIcon.textContent = '🍎 ';
            }
        } else {
            document.body.classList.remove('is-macos');
            document.body.classList.add('is-windows');
            
            // Keep original text for non-macOS platforms
            const resolveButton = document.querySelector('#resolveEnvIssues .button-title');
            if (resolveButton) {
                resolveButton.textContent = 'Resolve All Environment Issues';
            }
            
            // Update MCP server icon for Windows/Other
            const mcpServerIcon = document.getElementById('mcp-server-icon');
            if (mcpServerIcon) {
                mcpServerIcon.textContent = '🪟 ';
            }
        }
    } else if (message.command === 'mcpSetupProgress') {
        // Handle MCP setup progress updates
        handleMcpSetupProgress(message);
    } else if (message.command === 'installationStatus' &&
              (message.status === 'installing' || message.status === 'done' || message.status === 'error')) {
        // Only update installation status for valid installation statuses
        updateInstallationStatus(message.tool, message.status);
    } else if (message.command === 'pythonRequirementsInstallationStatus') {
        // Handle Python requirements installation status
        if (message.status === 'installing') {
            showStatusMessage('Installing Python requirements...', 'success');
        } else if (message.status === 'done') {
            showStatusMessage('Python requirements installed successfully!', 'success');
        } else if (message.status === 'error') {
            showStatusMessage(`Python requirements installation failed: ${message.message || 'Unknown error'}`, 'error');
        }
    } else if (message.command === 'statusMessage') {
        if (message.status === 'success') {
            showStatusMessage(`Success: ${message.message}`, 'success');
        } else {
            showStatusMessage(`Error: ${message.message}`, 'error');
        }

        // Show checking environment UI when auto re-check starts after resolution
        showCheckingEnvironmentUI();

        // If resolve button was in resolving state, transition it to checking state
        const resolveButton = document.getElementById('resolveEnvIssues') as HTMLButtonElement;
        if (resolveButton && resolveButton.classList.contains('resolving')) {
            // Transition from resolving to checking state
            resolveButton.classList.remove('resolving');
            resolveButton.classList.add('checking');
            resolveButton.innerHTML = '<span class="loading-spinner"></span> Checking environment...';            // Keep button disabled during checking
            resolveButton.disabled = true;
        }
    } else if (message.command === 'showCheckingEnvironment') {
        // Show checking environment UI when auto re-check starts after resolution
        showCheckingEnvironmentUI();

        // If resolve button was in resolving state, transition it to checking state
        const resolveButton = document.getElementById('resolveEnvIssues') as HTMLButtonElement;
        if (resolveButton && resolveButton.classList.contains('resolving')) {
            // Transition from resolving to checking state
            resolveButton.classList.remove('resolving');
            resolveButton.classList.add('checking');
            resolveButton.innerHTML = '<span class="loading-spinner"></span> Checking environment...';
            // Keep button disabled during checking
            resolveButton.disabled = true;        }    } else if (message.command === 'mcpServerSetup') {
        // Handle MCP server setup status
        if (message.status === 'success') {
            updateMcpServerStatus('success', message.message || 'MCP server setup completed successfully');
        } else if (message.status === 'error') {
            updateMcpServerStatus('error', message.message || 'MCP server setup failed');
        }
    } else if (message.command === 'mcpStatusUpdate' && message.mcpServerStatus) {
        // Handle MCP server status updates
        handleMcpServerStatus(message.mcpServerStatus);
    }
});

/**
 * Update the environment status indicators
 * @param status - The environment status object
 */
function updateEnvironmentStatus(status: EnvironmentStatus): void {
    try {
        // Update the message at the top
        const statusMessage = document.getElementById('env-status-message');
        if (statusMessage) {
            if (status.allReady) {
                statusMessage.textContent = '✓ All tools ready!';
                statusMessage.className = 'ready';
            } else {
                statusMessage.textContent = '⚠️ Some tools missing';
                statusMessage.className = 'not-ready';
            }
        } else {
            console.error('Could not find env-status-message element');
        }

        // Update the panel background when all checks pass
        const envStatusPanel = document.getElementById('env-status-section');
        if (envStatusPanel) {
            if (status.allReady) {
                envStatusPanel.classList.add('all-checks-passed');
            } else {
                envStatusPanel.classList.remove('all-checks-passed');
            }
        }        // Handle enabling/disabling other sections based on environment check
        // Only exclude env-status-section from masking, MCP server should be disabled when env is not ready
        const sections = document.querySelectorAll('.section-container');
        const sectionsToDisable = Array.from(sections).filter(section => 
            section.id !== 'env-status-section'  // Only exclude environment status section
        );
        
        // NEW LOGIC: Only remove overlay when environment is completely ready (allReady: true)
        // Otherwise, keep overlay visible during checking or when issues exist
        const shouldShowOverlay = !status.allReady;  // Show overlay unless ALL ready        // Apply overlay logic based on environment status
        if (shouldShowOverlay) {
            // Add a CSS class to the container to indicate disabled state
            document.querySelector('.card-container')?.classList.add('env-check-failed');

            // Determine overlay text based on status
            let overlayText = 'Please resolve environment issues first';
            if (isEnvironmentCheckInProgress) {
                overlayText = 'Checking environment status...';
            }

            // Update existing overlay text or create new overlays
            updateOverlayText(overlayText);
            document.querySelector('.card-container')?.classList.add('env-check-failed');            // Ensure all sections have proper disabled state and buttons are disabled
            sectionsToDisable.forEach((section, index) => {
                // Add disabled class to the section
                section.classList.add('section-disabled');
                
                // Find and disable all buttons
                const buttons = section.querySelectorAll('button');
                buttons.forEach((button) => {
                    button.disabled = true;
                    button.classList.add('disabled');
                });
                
                // Find and disable all links
                const links = section.querySelectorAll('a');
                links.forEach(link => {
                    link.classList.add('disabled-link');
                    link.setAttribute('disabled-link', 'true');
                    if (link.hasAttribute('href')) {
                        link.setAttribute('data-original-href', link.getAttribute('href') || '');
                        link.removeAttribute('href');
                    }
                });
                
                // Find and disable all input fields
                const inputs = section.querySelectorAll('input');
                inputs.forEach(input => {
                    input.disabled = true;
                });
                
                // Ensure overlay exists (may have been created in showInitialOverlayOnAllSections)
                if (!section.querySelector('.disabled-section-overlay')) {
                    const overlay = document.createElement('div');
                    overlay.className = 'disabled-section-overlay';
                    overlay.textContent = overlayText;
                    section.appendChild(overlay);
                      // Apply inline styles for MCP section
                    if (section.id === 'mcp-server-section') {
                        overlay.style.cssText = `
                            position: absolute !important;
                            top: 0 !important;
                            left: 0 !important;
                            right: 0 !important;
                            bottom: 0 !important;
                            background-color: rgba(0, 0, 0, 0.7) !important;
                            display: flex !important;
                            justify-content: center !important;
                            align-items: center !important;
                            z-index: 1000 !important;
                            border-radius: 4px !important;
                            font-size: 0.85rem !important;
                            font-weight: bold !important;
                            color: white !important;
                            text-align: center !important;
                            padding: 12px !important;
                        `;
                    }
                }
            });        } else {
            // Enable all sections if environment checks pass
            document.querySelector('.card-container')?.classList.remove('env-check-failed');

            sectionsToDisable.forEach((section, index) => {
                // Remove disabled class from the section
                section.classList.remove('section-disabled');
                  // Find and enable all buttons that aren't explicitly disabled for other reasons
                const buttons = section.querySelectorAll('button');
                buttons.forEach((button, btnIndex) => {
                    const buttonId = button.id || `unnamed-${btnIndex}`;
                    
                    // Skip buttons that should remain disabled (like Figma setup without API key)
                    if (button.id === 'setupFigmaMcp') {
                        // Only enable Figma button if API key is present
                        const figmaApiKeyInput = document.getElementById('figmaApiKey') as HTMLInputElement;
                        if (figmaApiKeyInput && figmaApiKeyInput.value.trim() !== '') {
                            button.disabled = false;
                            button.classList.remove('disabled');
                        }
                    } else {
                        button.disabled = false;
                        button.classList.remove('disabled');
                    }
                });

                // Find and enable all links
                const links = section.querySelectorAll('a');
                links.forEach(link => {
                    link.classList.remove('disabled-link');
                    link.removeAttribute('disabled-link');
                    if (link.hasAttribute('data-original-href')) {
                        link.setAttribute('href', link.getAttribute('data-original-href') || '#');
                        link.removeAttribute('data-original-href');
                    }
                });

                // Find and enable all input fields
                const inputs = section.querySelectorAll('input');
                inputs.forEach(input => {
                    input.disabled = false;
                });                // Remove any overlay
                const overlay = section.querySelector('.disabled-section-overlay');
                if (overlay) {
                    section.removeChild(overlay);
                }
            });
        }// Update all status items to show current state
        const envStatusList = document.getElementById('env-status-list');
        if (envStatusList) {            // Get all status elements
            const npmStatusElement = document.getElementById('env-npm-status');
            const codeStatusElement = document.getElementById('env-code-status');
            const pythonStatusElement = document.getElementById('env-python-status');
            const uvStatusElement = document.getElementById('env-uv-status');
            const dotnetStatusElement = document.getElementById('env-dotnet-status');
            const pipStatusElement = document.getElementById('env-pip-status');

            // Show ALL status items with their current state (ready or not-ready)
            // NPM status
            if (npmStatusElement) {
                npmStatusElement.style.display = 'flex';
                if (status.npm) {
                    npmStatusElement.innerHTML = `<span class="status-indicator ready"></span>
                                               NPM tool: <strong>Ready</strong>`;
                } else {
                    npmStatusElement.innerHTML = `<span class="status-indicator not-ready"></span>
                                               NPM tool: <strong>Not installed</strong>`;
                }
            }

            // Code CLI status
            if (codeStatusElement) {
                codeStatusElement.style.display = 'flex';
                if (status.code) {
                    codeStatusElement.innerHTML = `<span class="status-indicator ready"></span>
                                                VS Code CLI: <strong>Ready</strong>`;
                } else {
                    codeStatusElement.innerHTML = `<span class="status-indicator not-ready"></span>
                                                VS Code CLI: <strong>Not installed</strong>`;
                }
            }            // Python status with enhanced error reporting
            if (pythonStatusElement) {
                pythonStatusElement.style.display = 'flex';
                if (status.python === true) {
                    pythonStatusElement.innerHTML = `<span class="status-indicator ready"></span>
                                                  Python(>=3.10): <strong>Ready (${status.pythonVersion || 'Unknown version'})</strong>`;                } else {
                    // Enhanced error display with detailed information
                    let errorInfo = status.pythonDetailedError || status.pythonError || 'Not found or version < 3.10';
                    
                    // Only show found versions if we don't already have detailed error info
                    // This prevents duplicate version information in the error message
                    if (status.pythonFoundVersions && status.pythonFoundVersions.length > 0 && !status.pythonDetailedError) {
                        const versionsList = status.pythonFoundVersions
                            .map(v => `${v.command} (${v.version})${v.isCompatible ? ' ✅' : ' ❌'}`)
                            .join(', ');
                        errorInfo = `${errorInfo} | Found: ${versionsList}`;
                    }
                    
                    pythonStatusElement.innerHTML = `<span class="status-indicator not-ready"></span>
                                                  Python(>=3.10): <strong>${errorInfo}</strong>`;
                    
                    // Add click handler to show detailed guidance
                    pythonStatusElement.style.cursor = 'pointer';
                    pythonStatusElement.title = 'Click for installation guidance';
                    pythonStatusElement.onclick = () => {
                        if (status.pythonInstallationGuidance) {
                            showPythonInstallationGuidance(status.pythonInstallationGuidance, status.pythonFoundVersions);
                        }
                    };
                }
            }

            // UV status
            if (uvStatusElement) {
                uvStatusElement.style.display = 'flex';
                if (status.uv) {
                    uvStatusElement.innerHTML = `<span class="status-indicator ready"></span>
                                              UV tool: <strong>Ready</strong>`;
                } else {
                    uvStatusElement.innerHTML = `<span class="status-indicator not-ready"></span>
                                              UV tool: <strong>Not installed</strong>`;
                }
            }

            // .NET SDK status (disabled for macOS)
            if (dotnetStatusElement) {
                // Hide dotnet status since we no longer support it on macOS
                dotnetStatusElement.style.display = 'none';
            }

            // Pip status (not shown separately since it's part of UV Python environment)
            // if (pipStatusElement && status.pip === false) {
            //     pipStatusElement.style.display = 'flex';
            //     pipStatusElement.innerHTML = `<span class="status-indicator not-ready"></span>
            //                                Pip: <strong>Not installed</strong>`;
            //            }            // Always show the status list to display current state
            envStatusList.style.display = 'block';

            // Show/hide the resolve issues button based on new logic
            const resolveIssuesContainer = document.getElementById('resolve-env-issues-container');
            if (resolveIssuesContainer) {
                if (status.allReady) {
                    // Hide the resolve issues button if all issues are resolved
                    resolveIssuesContainer.classList.add('hidden');
                } else {
                    // NEW LOGIC: Show resolve button and/or manual install messages based on issue types
                    // BUT: Don't update button state if it's currently in resolving/checking state
                    const resolveButton = document.getElementById('resolveEnvIssues') as HTMLButtonElement;
                    const isButtonInProgressState = resolveButton && 
                        (resolveButton.classList.contains('resolving') || resolveButton.classList.contains('checking'));
                    
                    if (!isButtonInProgressState) {
                        // Only update button logic if it's not currently processing
                        handleResolveButtonLogic(status, resolveIssuesContainer);
                    } else {
                        // Still need to ensure container is visible
                        resolveIssuesContainer.classList.remove('hidden');
                    }
                }
            }
        }

        console.log('Environment status update completed successfully');
    } catch (error) {
        console.error('Error updating environment status UI:', error);
    }
}

/**
 * Update the installation status of a specific tool
 * @param tool - The name of the tool being installed
 * @param status - The installation status ('installing' | 'done' | 'error' | undefined)
 */
function updateInstallationStatus(tool: string | undefined, status: 'installing' | 'done' | 'error' | undefined): void {
    if (!tool || !status) {
        console.error('Invalid tool or status');
        return;
    }
    
    const toolMap: Record<string, string> = {
        'uv': 'env-uv-status',
        'npm': 'env-npm-status',
        'code': 'env-code-status',
        'python': 'env-python-status', // Map python to the correct element
        'uvPythonEnvironment': 'env-python-status'
    };

    const elementId = toolMap[tool];
    if (!elementId) {
        console.error(`Unknown tool: ${tool}`);
        return;
    }

    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Could not find element for tool: ${tool}`);
        return;
    }    // Update the indicator and text
    if (status === 'installing') {
        element.style.display = 'flex';
        let displayName = tool;
        if (tool === 'uvPythonEnvironment') {
            displayName = 'UV Python Environment';
        } else {
            displayName = mapToolNameToDisplayName(tool);
        }
        element.innerHTML = `<span class="status-indicator installing"></span> ${displayName}: <strong>Installing...</strong>`;    } else if (status === 'done') {
        element.style.display = 'flex';
        let displayName = tool;
        if (tool === 'uvPythonEnvironment') {
            displayName = 'UV Python Environment';
        } else {
            displayName = mapToolNameToDisplayName(tool);
        }
        element.innerHTML = `<span class="status-indicator ready"></span> ${displayName}: <strong>Installed</strong>`;    } else if (status === 'error') {
        element.style.display = 'flex';
        let displayName = tool;
        if (tool === 'uvPythonEnvironment') {
            displayName = 'UV Python Environment';
        } else {
            displayName = mapToolNameToDisplayName(tool);
        }
        element.innerHTML = `<span class="status-indicator not-ready"></span> ${displayName}: <strong>Installation failed</strong>`;
    }
}

/**
 * Function to display status messages
 * @param message - The message to display
 * @param type - The type of message ('success' or 'error')
 */
function showStatusMessage(message: string, type: 'success' | 'error'): void {
    // Check if status message container exists
    let statusContainer = document.getElementById('status-container');

    // Create it if it doesn't exist
    if (!statusContainer) {
        statusContainer = document.createElement('div');
        statusContainer.id = 'status-container';
        const container = document.querySelector('.container');
        if (container) {
            container.appendChild(statusContainer);
        }
    }

    // Create the message element
    const statusMessage = document.createElement('div');
    statusMessage.classList.add('status-message', type);
    statusMessage.textContent = message;

    // Add it to the container
    statusContainer.innerHTML = ''; // Clear previous messages
    statusContainer.appendChild(statusMessage);

    // Remove after 3 seconds
    setTimeout(() => {
        statusMessage.classList.add('fade-out');
        setTimeout(() => {
            statusContainer.innerHTML = '';
        }, 500);
    }, 3000);
}

/**
 * Disable specific buttons until initial environment check completes
 */
function disableButtonsUntilEnvironmentCheck(): void {
    // Implementation would go here if needed
}

/**
 * Enable buttons after initial environment check completes (if environment is ready)
 */
function enableButtonsAfterEnvironmentCheck(environmentReady: boolean): void {
    // Implementation would go here if needed
}

// Wait for the document to load
window.addEventListener('load', function () {
    // Check all sections
    const allPageSections = document.querySelectorAll('.section-container');

    // Get reference to the buttons and input
    const refreshEnvironmentButton = document.getElementById('refreshEnvironment') as HTMLButtonElement;
    const resolveEnvIssuesButton = document.getElementById('resolveEnvIssues') as HTMLButtonElement;// Add event listeners to prevent clicking on disabled sections
    // Only exclude env-status-section from click prevention, MCP server should be disabled when env is not ready
    const sectionsToMonitor = Array.from(allPageSections).filter(section => 
        section.id !== 'env-status-section'  // Only exclude environment status section
    );
    
    sectionsToMonitor.forEach(section => {
        section.addEventListener('click', (event) => {
            if (section.classList.contains('section-disabled')) {
                event.preventDefault();
                event.stopPropagation();

                // Show a message to the user that they need to resolve environment issues
                showStatusMessage('Please resolve environment issues before using this feature', 'error');

                // Highlight the environment section to draw attention to it
                const envSection = document.getElementById('env-status-section');
                if (envSection) {
                    envSection.classList.add('highlight-section');
                    setTimeout(() => {
                        envSection.classList.remove('highlight-section');
                    }, 1500);
                }

                return false;
            }
        }, true); // Use capture phase to catch events before they reach children
    });

    // Notify the extension that the webview is loaded
    vscode.postMessage({
        command: 'webviewLoaded'
    });    // Resolve environment issues button
    if (resolveEnvIssuesButton) {
        resolveEnvIssuesButton.addEventListener('click', function() {
            // Enhanced visual feedback - add loading state
            this.classList.add('resolving');
            this.disabled = true;

            // Store original text
            const originalText = this.textContent;

            // Update button text and add loading animation
            this.innerHTML = '<span class="loading-spinner"></span> Resolving issues...';

            // Add pulsing animation to the entire environment section
            const envSection = document.getElementById('env-status-section');
            if (envSection) {
                envSection.classList.add('resolving-issues');
            }

            // Send a message to the extension to resolve environment issues
            vscode.postMessage({
                command: 'resolveEnvironmentIssues'
            });

            // Keep timeout as a safety fallback, but only in case of errors or no response
            // Normal completion will be handled by environmentStatus message
            setTimeout(() => {
                // Only reset if the button is still in resolving or checking state (indicating error or no response)
                if (this.classList.contains('resolving') || this.classList.contains('checking')) {
                    console.log('Timeout reached - resetting resolve button state as fallback');
                    this.classList.remove('resolving', 'checking');
                    this.disabled = false;
                    this.innerHTML = originalText || 'Resolve all environment issues';

                    if (envSection) {
                        envSection.classList.remove('resolving-issues');
                    }
                }
            }, 180000); // Increased to 3 minutes (180 seconds) to allow more time for long installations
        });
    }    // Refresh environment status button
    if (refreshEnvironmentButton) {
        refreshEnvironmentButton.addEventListener('click', function() {
            // Show checking environment UI
            showCheckingEnvironmentUI();

            // Send a message to the extension to recheck environment
            vscode.postMessage({
                command: 'checkEnvironment'
            });
        });
    }

    // Add click event listeners for external links
    document.querySelectorAll('.external-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const url = (link as HTMLElement).getAttribute('data-url');
            if (url) {
                // Send message to extension to open the URL in browser
                vscode.postMessage({
                    command: 'openExternalUrl',
                    url: url
                });
            }
        });
    });

    // Add click event listeners for all settings.json links
    document.querySelectorAll('.settings-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // Send message to extension to open settings.json
            vscode.postMessage({
                command: 'openSettingsJson'
            });
        });
    });

    // Add click event listener for the instructions link
    const instructionsLocationLink = document.getElementById('openInstructionsLocation');
    if (instructionsLocationLink) {
        instructionsLocationLink.addEventListener('click', (e) => {
            e.preventDefault();
            // Send message to extension to open instructions location
            vscode.postMessage({
                command: 'openInstructionsLocation'
            });
        });
    }

    // Function to update the Figma button state based on input
    function updateFigmaButtonState(): void {
        
    }

    // Add event listener to the API key input
    // figmaApiKeyInput.addEventListener('input', updateFigmaButtonState);    // Initial button state check
    updateFigmaButtonState();    // MCP Server Management Button Event Listeners
    const setupWindowsMcpButton = document.getElementById('setupWindowsMcp') as HTMLButtonElement;
    const setupAppiumMcpWindowsButton = document.getElementById('setupAppiumMcpWindows') as HTMLButtonElement;
    const setupAppiumMcpMacButton = document.getElementById('setupAppiumMcpMac') as HTMLButtonElement;
    const openMcpSettingsButton = document.getElementById('openMcpSettings') as HTMLButtonElement;

    // Windows - pywinauto MCP server setup
    if (setupWindowsMcpButton) {
        setupWindowsMcpButton.addEventListener('click', function(this: HTMLButtonElement) {
            handleMcpSetupClick(this, 'setupWindowsMcp', 'windows');
        });
        addMcpButtonHoverEffects(setupWindowsMcpButton);
    }

    // Windows - Appium MCP server setup
    if (setupAppiumMcpWindowsButton) {
        setupAppiumMcpWindowsButton.addEventListener('click', function(this: HTMLButtonElement) {
            handleMcpSetupClick(this, 'setupAppiumMcp', 'appium');
        });
        addMcpButtonHoverEffects(setupAppiumMcpWindowsButton);
    }

    // macOS - Appium MCP server setup
    if (setupAppiumMcpMacButton) {
        setupAppiumMcpMacButton.addEventListener('click', function(this: HTMLButtonElement) {
            handleMcpSetupClick(this, 'setupAppiumMcp', 'appium');
        });
        addMcpButtonHoverEffects(setupAppiumMcpMacButton);
    }

    if (openMcpSettingsButton) {
        openMcpSettingsButton.addEventListener('click', function(this: HTMLButtonElement) {
            // Add visual feedback for click
            this.classList.add('clicked');
            setTimeout(() => {
                this.classList.remove('clicked');
            }, 200);

            // Send a message to the extension
            vscode.postMessage({
                command: 'openMcpSettings'
            });
        });

        // Add hover effects
        openMcpSettingsButton.addEventListener('mouseover', function(this: HTMLButtonElement) {
            if (!this.classList.contains('disabled')) {
                this.style.opacity = '0.9';
            }
        });

        openMcpSettingsButton.addEventListener('mouseout', function(this: HTMLButtonElement) {
            if (!this.classList.contains('disabled')) {
                this.style.opacity = '1';
            }
        });
    }

 
    // Indicate that JavaScript is loaded
    console.log('WebView JavaScript initialized');
});

// Clear all list items first
function hideAllStatusItems(uvStatusElement: HTMLElement | null, npmStatusElement: HTMLElement | null, codeStatusElement: HTMLElement | null, dotnetStatusElement: HTMLElement | null, pythonStatusElement?: HTMLElement | null, pipStatusElement?: HTMLElement | null): void {
    // Hide all items initially
    if (uvStatusElement) {
        uvStatusElement.style.display = 'none';
    }
    if (npmStatusElement) {
        npmStatusElement.style.display = 'none';
    }
    if (codeStatusElement) {
        codeStatusElement.style.display = 'none';
    }
    if (dotnetStatusElement) {
        dotnetStatusElement.style.display = 'none';
    }
    if (pythonStatusElement) {
        pythonStatusElement.style.display = 'none';
    }
    if (pipStatusElement) {
        pipStatusElement.style.display = 'none';
    }
}

/**
 * Reset the resolve environment issues button to its normal state
 */
function resetResolveButtonState(): void {
    const resolveEnvIssuesButton = document.getElementById('resolveEnvIssues') as HTMLButtonElement;
    const envSection = document.getElementById('env-status-section');

    if (resolveEnvIssuesButton) {
        resolveEnvIssuesButton.classList.remove('resolving', 'checking');
        resolveEnvIssuesButton.disabled = false;
        
        // Set button text based on platform
        const isMacOS = document.body.classList.contains('is-macos');
        resolveEnvIssuesButton.innerHTML = isMacOS 
            ? 'Auto Resolve All Issues' 
            : 'Resolve all environment issues';
    }

    if (envSection) {
        envSection.classList.remove('resolving-issues');
    }
}

/**
 * Show visual feedback when environment check is in progress
 */
function showCheckingEnvironmentUI(): void {
    isEnvironmentCheckInProgress = true;

    // Update the status message
    const statusMessage = document.getElementById('env-status-message');
    if (statusMessage) {
        statusMessage.textContent = '🔄 Checking environment...';
        statusMessage.className = 'checking';
    }

    // Add checking animation to environment section
    const envSection = document.getElementById('env-status-section');
    if (envSection) {
        envSection.classList.add('checking-environment');
        // Keep resolving-issues class if it's there - don't reset resolve button during resolution
        // Only remove it if we're not in a resolving state
        const resolveButton = document.getElementById('resolveEnvIssues') as HTMLButtonElement;
        if (!resolveButton || !resolveButton.classList.contains('resolving')) {
            envSection.classList.remove('resolving-issues');
        }
    }

    // **IMPORTANT: Force show overlays during environment checking, regardless of previous state**
    // This ensures that even if environment was previously ready, overlays appear during refresh
    forceShowOverlaysWithText('Checking environment status...');

    // Hide the status list while checking
    const envStatusList = document.getElementById('env-status-list');
    if (envStatusList) {
        envStatusList.style.display = 'none';
    }

    // Hide resolve issues button while checking
    const resolveIssuesContainer = document.getElementById('resolve-env-issues-container');
    if (resolveIssuesContainer) {
        resolveIssuesContainer.classList.add('hidden');
    }
}

/**
 * Hide checking environment UI when check is complete
 */
function hideCheckingEnvironmentUI(): void {
    isEnvironmentCheckInProgress = false;

    // Remove checking animation from environment section
    const envSection = document.getElementById('env-status-section');
    if (envSection) {
        envSection.classList.remove('checking-environment');
    }

    // Show the status list again
    const envStatusList = document.getElementById('env-status-list');
    if (envStatusList) {
        envStatusList.style.display = 'block';
    }

    // Note: Don't automatically show resolve issues button here
    // Let updateEnvironmentStatus() decide whether to show it based on actual environment status
}

/**
 * Update MCP server status display
 * @param status - The server status ('processing' | 'success' | 'error')
 * @param message - Optional message to display
 */
function updateMcpServerStatus(status: string, message?: string): void {
    const statusContainer = document.getElementById('mcp-status-container');
    const statusMessage = document.getElementById('mcp-status-message');

    if (!statusContainer || !statusMessage) {
        console.warn('MCP status container or message element not found');
        return;
    }

    // Show status container and update message
    statusContainer.classList.remove('hidden');
    statusMessage.textContent = message || '';

    // Remove all status classes
    statusContainer.classList.remove('success', 'error', 'processing');

    // Add appropriate status class
    switch (status) {
        case 'processing':
            statusContainer.classList.add('processing');
            break;
        case 'success':
            statusContainer.classList.add('success');
            // Auto-hide success message after 3 seconds
            setTimeout(() => {
                statusContainer.classList.add('hidden');
            }, 3000);
            break;
        case 'error':
            statusContainer.classList.add('error');
            // Auto-hide error message after 5 seconds
            setTimeout(() => {
                statusContainer.classList.add('hidden');
            }, 5000);
            break;
        default:
            statusContainer.classList.add('hidden');
            break;
    }
}

/**
 * Restore the setup button to its normal state after MCP setup completion
 */
/**
 * Restore all MCP setup buttons to their normal state after setup completion
 */
function restoreSetupButton(): void {
    const setupButtons = [
        document.getElementById('setupWindowsMcp') as HTMLButtonElement,
        document.getElementById('setupAppiumMcpWindows') as HTMLButtonElement,
        document.getElementById('setupAppiumMcpMac') as HTMLButtonElement
    ];

    setupButtons.forEach(setupButton => {
        if (setupButton && setupButton.classList.contains('setting-up')) {
            setupButton.disabled = false;
            setupButton.classList.remove('setting-up');
            
            // Restore original text
            const originalText = setupButton.getAttribute('data-original-text');
            if (originalText) {
                setupButton.innerHTML = originalText;
                setupButton.removeAttribute('data-original-text');
            } else {                // Fallback to default text based on button type
                if (setupButton.id === 'setupWindowsMcp') {
                    setupButton.innerHTML = '<span class="button-title">Setup MCP Server (pywinauto)</span><span class="button-subtitle">Initialize and configure windows automation MCP server</span>';
                } else if (setupButton.id === 'setupAppiumMcpWindows') {
                    setupButton.innerHTML = '<span class="button-title">Setup MCP Server (appium)</span><span class="button-subtitle">Initialize and configure appium automation MCP server</span>';
                } else if (setupButton.id === 'setupAppiumMcpMac') {
                    setupButton.innerHTML = '<span class="button-title">Setup MCP Server (appium)</span>';
                }
            }
        }
    });
}

/**
 * Map internal tool identifiers to user-friendly display names
 * @param toolName - The internal tool identifier
 * @returns The user-friendly display name
 */
function mapToolNameToDisplayName(toolName: string): string {
    switch (toolName) {
        case 'code':
            return 'VS Code CLI';
        case 'uv':
            return 'UV tool';
        case 'npm':
            return 'Node.js & NPM';
        case 'python':
            return 'Python (≥3.10)';
        case 'dotnet':
            return '.NET SDK';
        default:
            return toolName;
    }
}

/**
 * Handle the new resolve button logic based on what types of issues exist
 * @param status - The environment status object
 * @param resolveIssuesContainer - The container element for the resolve button
 */
function handleResolveButtonLogic(status: EnvironmentStatus, resolveIssuesContainer: HTMLElement): void {
    // Clear any existing manual install messages
    const existingMessages = resolveIssuesContainer.querySelectorAll('.manual-install-message');
    existingMessages.forEach(msg => msg.remove());

    const resolveButton = document.getElementById('resolveEnvIssues') as HTMLButtonElement;
    
    // Determine what to show based on issue types
    const hasManualIssues = status.manualInstallNeeded && status.manualInstallNeeded.length > 0;
    const hasAutoIssues = status.autoResolveNeeded && status.autoResolveNeeded.length > 0;

    if (hasManualIssues && hasAutoIssues) {
        // Case 1: Both manual and auto issues exist
        // Show resolve button for auto issues + manual install prompt
        resolveIssuesContainer.classList.remove('hidden');
        if (resolveButton) {
            resolveButton.style.display = 'block';
            
            // Set button text based on platform
            const isMacOS = document.body.classList.contains('is-macos');
            if (isMacOS) {
                resolveButton.textContent = 'Auto Resolve All Issues';
            } else {
                // Map tool names to display names for non-macOS
                const displayNames = status.autoResolveNeeded.map(tool => mapToolNameToDisplayName(tool));
                resolveButton.textContent = `Auto-resolve: ${displayNames.join(', ')}`;
            }
        }
        showManualInstallMessage(status.manualInstallNeeded, resolveIssuesContainer);
        
    } else if (hasManualIssues && !hasAutoIssues) {
        // Case 2: Only manual issues exist
        // Hide resolve button, show only manual install prompt
        if (resolveButton) {
            resolveButton.style.display = 'none';
        }
        resolveIssuesContainer.classList.remove('hidden');
        showManualInstallMessage(status.manualInstallNeeded, resolveIssuesContainer);
          } else if (!hasManualIssues && hasAutoIssues) {
        // Case 3: Only auto issues exist
        // Show resolve button only
        resolveIssuesContainer.classList.remove('hidden');
        if (resolveButton) {
            resolveButton.style.display = 'block';
            
            // Set button text based on platform
            const isMacOS = document.body.classList.contains('is-macos');
            if (isMacOS) {
                resolveButton.textContent = 'Auto Resolve All Issues';
            } else {
                // Map tool names to display names for non-macOS
                const displayNames = status.autoResolveNeeded.map(tool => mapToolNameToDisplayName(tool));
                resolveButton.textContent = `Auto-resolve: ${displayNames.join(', ')}`;
            }
        }
    } else {
        // Case 4: No issues (shouldn't reach here since allReady would be true)
        resolveIssuesContainer.classList.add('hidden');
    }
}

/**
 * Show manual installation message for tools that need manual installation
 * @param toolsNeeded - Array of tool names that need manual installation
 * @param container - The container to add the message to
 */
function showManualInstallMessage(toolsNeeded: string[], container: HTMLElement): void {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'manual-install-message';
    messageDiv.style.cssText = `
        margin-top: 10px;
        padding: 12px;
        background-color: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 4px;
        color: #856404;
        font-size: 0.9em;
        line-height: 1.4;
    `;

    // Use the consistent mapping function
    const toolNames = toolsNeeded.map(tool => mapToolNameToDisplayName(tool)).join(' and ');

    let installInstructions = '';
    if (toolsNeeded.includes('npm')) {
        installInstructions += `
            <br><strong>Node.js & NPM:</strong> Visit <a href="#" class="external-link" data-url="https://nodejs.org">nodejs.org</a> to download and install
        `;
    }
    if (toolsNeeded.includes('python')) {
        installInstructions += `
            <br><strong>Python:</strong> Click on the Python status above for detailed installation guidance
        `;
    }

    messageDiv.innerHTML = `
        <strong>⚠️ Manual Installation Required</strong><br>
        The following tools require manual installation: <strong>${toolNames}</strong>
        ${installInstructions}
    `;

    // Add click handlers for external links
    messageDiv.querySelectorAll('.external-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const url = (e.target as HTMLElement).getAttribute('data-url');
            if (url) {
                vscode.postMessage({
                    command: 'openExternalUrl',
                    url: url
                });
            }
        });
    });

    container.appendChild(messageDiv);
}

/**
 * Handle MCP setup progress updates
 * @param message - The progress message from the extension
 */
function handleMcpSetupProgress(message: VSCodeMessage): void {
    const { step, message: progressMessage, progress } = message;

    if (step === 'error') {
        updateMcpServerStatus('error', progressMessage);
        // Re-enable setup button on error
        restoreSetupButton();
        return;
    }

    if (step === 'completed') {
        updateMcpServerStatus('success', progressMessage);
        
        // Ensure progress bar shows 100% on completion
        const statusContainer = document.getElementById('mcp-status-container');
        if (statusContainer) {
            const progressBar = statusContainer.querySelector('.progress-bar') as HTMLElement;
            if (progressBar) {
                const progressFill = progressBar.querySelector('.progress-fill') as HTMLElement;
                if (progressFill) {
                    progressFill.style.width = '100%';
                }
            }
        }
        
        // Re-enable setup button on success
        restoreSetupButton();
        return;
    }

    // Show processing status with detailed progress message
    updateMcpServerStatus('processing', progressMessage);// Update progress indicator if it exists
    const statusContainer = document.getElementById('mcp-status-container');
    
    if (statusContainer && progress !== undefined) {
        // Add progress bar if it doesn't exist
        let progressBar = statusContainer.querySelector('.progress-bar') as HTMLElement;
        if (!progressBar) {
            progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            progressBar.innerHTML = '<div class="progress-fill"></div>';
            statusContainer.appendChild(progressBar);
        }

        // Update progress - ensure it reaches 100% for completion
        const progressFill = progressBar.querySelector('.progress-fill') as HTMLElement;
        if (progressFill) {
            const clampedProgress = Math.max(0, Math.min(100, progress));
            progressFill.style.width = `${clampedProgress}%`;
        }
    }
}

/**
 * Handle MCP server status updates from the backend
 * @param mcpStatus - The MCP server status object
 */
function handleMcpServerStatus(mcpStatus: McpServerStatus): void {
    const statusContainer = document.getElementById('mcp-status-container');
    const statusMessage = document.getElementById('mcp-status-message');
    
    if (!statusContainer || !statusMessage) {
        console.warn('MCP status elements not found');
        return;
    }
      // Show the status container
    statusContainer.classList.remove('hidden');
    
    // Remove all status classes
    statusContainer.classList.remove('success', 'error', 'processing', 'warning');
      // Update based on status
    switch (mcpStatus.status) {
        case 'none':
            // No MCP server configuration found - show ready to setup
            statusContainer.classList.add('processing');
            statusMessage.textContent = mcpStatus.message || 'Ready to setup';
            // Don't set inline style - let CSS handle the color
            break;
            
        case 'complete':
            // MCP server is already configured - show success with green text
            statusContainer.classList.add('success');
            statusMessage.textContent = mcpStatus.message || 'MCP server configured successfully';
            // Don't set inline style - let CSS handle the color
            break;
            
        case 'update_available':
            // MCP server needs update - show warning with red text and pulsing
            statusContainer.classList.add('warning');
            statusMessage.textContent = mcpStatus.message || 'MCP server updated, please setup again!';
            // Don't set inline style - let CSS handle the color
            break;
    }
    
    // For update warnings, keep the message visible; for others, auto-hide after 5 seconds
    if (mcpStatus.status !== 'update_available') {
        setTimeout(() => {
            statusContainer.classList.add('hidden');
        }, 5000);
    }
}

/**
 * Show initial overlay on all sections except env-status-section
 * This is called on page load since environment status is not yet confirmed
 */
function showInitialOverlayOnAllSections(): void {
    const sections = document.querySelectorAll('.section-container');
    const sectionsToDisable = Array.from(sections).filter(section => 
        section.id !== 'env-status-section'  // Only exclude environment status section
    );
    
    // Add disabled state to container
    document.querySelector('.card-container')?.classList.add('env-check-failed');
    
    sectionsToDisable.forEach((section, index) => {
        // Add disabled class to the section
        section.classList.add('section-disabled');
        
        // Find and disable all buttons
        const buttons = section.querySelectorAll('button');
        buttons.forEach((button) => {
            button.disabled = true;
            button.classList.add('disabled');
        });
        
        // Find and disable all links
        const links = section.querySelectorAll('a');
        links.forEach(link => {
            link.classList.add('disabled-link');
            link.setAttribute('disabled-link', 'true');
            if (link.hasAttribute('href')) {
                link.setAttribute('data-original-href', link.getAttribute('href') || '');
                link.removeAttribute('href');
            }
        });
        
        // Find and disable all input fields
        const inputs = section.querySelectorAll('input');
        inputs.forEach(input => {
            input.disabled = true;
        });
        
        // Add overlay if it doesn't exist
        if (!section.querySelector('.disabled-section-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'disabled-section-overlay';
            overlay.textContent = 'Checking environment status...';
            section.appendChild(overlay);
              // Apply inline styles for better visibility
            if (section.id === 'mcp-server-section') {
                overlay.style.cssText = `
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    bottom: 0 !important;
                    background-color: rgba(0, 0, 0, 0.7) !important;
                    display: flex !important;
                    justify-content: center !important;
                    align-items: center !important;
                    z-index: 1000 !important;
                    border-radius: 4px !important;
                    font-size: 0.85rem !important;
                    font-weight: bold !important;
                    color: white !important;
                    text-align: center !important;
                    padding: 12px !important;
                `;
            }
        }
    });
}

/**
 * Update overlay text to reflect current status
 * @param overlayText - The text to display in the overlay
 */
function updateOverlayText(overlayText: string): void {
    const sections = document.querySelectorAll('.section-container');
    const sectionsToUpdate = Array.from(sections).filter(section => 
        section.id !== 'env-status-section'
    );
    
    sectionsToUpdate.forEach(section => {
        const overlay = section.querySelector('.disabled-section-overlay');
        if (overlay) {
            overlay.textContent = overlayText;
        }
    });
}

/**
 * Force show overlays with specified text, regardless of current environment state
 * This is used during environment checking to ensure overlays are visible even if environment was previously ready
 * @param overlayText - The text to display in the overlay
 */
function forceShowOverlaysWithText(overlayText: string): void {
    const sections = document.querySelectorAll('.section-container');
    const sectionsToMask = Array.from(sections).filter(section => 
        section.id !== 'env-status-section'  // Only exclude environment status section
    );
    
    // Add environment check state class to container
    document.querySelector('.card-container')?.classList.add('env-check-failed');
    
    sectionsToMask.forEach((section, index) => {
        // Add disabled class to the section
        section.classList.add('section-disabled');
        
        // Disable all buttons
        const buttons = section.querySelectorAll('button');
        buttons.forEach((button) => {
            button.disabled = true;
            button.classList.add('disabled');
        });
        
        // Disable all links
        const links = section.querySelectorAll('a');
        links.forEach(link => {
            link.classList.add('disabled-link');
            link.setAttribute('disabled-link', 'true');
            if (link.hasAttribute('href')) {
                link.setAttribute('data-original-href', link.getAttribute('href') || '');
                link.removeAttribute('href');
            }
        });
        
        // Disable all input fields
        const inputs = section.querySelectorAll('input');
        inputs.forEach(input => {
            input.disabled = true;
        });
        
        // Remove existing overlay if present
        const existingOverlay = section.querySelector('.disabled-section-overlay');
        if (existingOverlay) {
            section.removeChild(existingOverlay);
        }
        
        // Create new overlay
        const overlay = document.createElement('div');
        overlay.className = 'disabled-section-overlay';
        overlay.textContent = overlayText;
        section.appendChild(overlay);
          // Apply inline styles for better visibility
        if (section.id === 'mcp-server-section') {
            overlay.style.cssText = `
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                background-color: rgba(0, 0, 0, 0.7) !important;
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                z-index: 1000 !important;
                border-radius: 4px !important;
                font-size: 0.85rem !important;
                font-weight: bold !important;
                color: white !important;
                text-align: center !important;
                padding: 12px !important;
            `;
        }
    });
}

/**
 * Handle MCP setup button click
 * @param button - The button element that was clicked
 * @param command - The command to send to the extension
 * @param serverType - The type of server (pywinauto or appium)
 */
function handleMcpSetupClick(button: HTMLButtonElement, command: string, serverType: string): void {
    // Prevent multiple clicks during setup
    if (button.disabled || button.classList.contains('disabled') || button.classList.contains('setting-up')) {
        return;
    }

    // Add visual feedback for click
    button.classList.add('clicked');
    setTimeout(() => {
        button.classList.remove('clicked');
    }, 200);

    // Disable button during setup
    button.disabled = true;
    button.classList.add('setting-up');
    const originalText = button.innerHTML;
    button.innerHTML = `<span class="loading-spinner"></span> Setting up MCP server (${serverType})...`;

    // Store original text for restoration
    button.setAttribute('data-original-text', originalText);

    // Update status
    updateMcpServerStatus('processing', `Setting up MCP server (${serverType})...`);

    // Send a message to the extension
    vscode.postMessage({
        command: command,
        serverType: serverType
    });
}

/**
 * Add hover effects to MCP setup buttons
 * @param button - The button element to add hover effects to
 */
function addMcpButtonHoverEffects(button: HTMLButtonElement): void {
    button.addEventListener('mouseover', function(this: HTMLButtonElement) {
        if (!this.classList.contains('disabled')) {
            this.style.opacity = '0.9';
        }
    });

    button.addEventListener('mouseout', function(this: HTMLButtonElement) {
        if (!this.classList.contains('disabled')) {
            this.style.opacity = '1';
        }
    });
}

