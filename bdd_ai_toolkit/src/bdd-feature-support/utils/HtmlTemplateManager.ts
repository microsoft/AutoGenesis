import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/**
 * HTML template manager for loading and rendering HTML templates
 */
export class HtmlTemplateManager {
  private static instance: HtmlTemplateManager;
  private templateCache: Map<string, string> = new Map();

  private constructor(private context: vscode.ExtensionContext) {}

  public static getInstance(
    context?: vscode.ExtensionContext
  ): HtmlTemplateManager {
    if (!HtmlTemplateManager.instance && context) {
      HtmlTemplateManager.instance = new HtmlTemplateManager(context);
    }
    return HtmlTemplateManager.instance;
  }

  /**
   * Convert an absolute file path to a relative path based on the workspace folder
   */
  private convertToRelativePath(absolutePath: string): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return absolutePath;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    if (absolutePath.startsWith(rootPath)) {
      return path.relative(rootPath, absolutePath).replace(/\\/g, "/");
    }

    return absolutePath;
  }

  /**
   * Load HTML template from resources folder
   */
  private loadTemplate(templateName: string): string {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    const templatePath = path.join(
      this.context.extensionPath,
      "resources",
      templateName
    );

    try {
      const template = fs.readFileSync(templatePath, "utf-8");
      this.templateCache.set(templateName, template);
      return template;
    } catch (error) {
      console.error(`Failed to load template ${templateName}:`, error);
      throw new Error(`Failed to load HTML template: ${templateName}`);
    }
  }

  /**
   * Build HTML for implementation steps
   */
  public buildStepsHtml(implementationDetails: any[]): string {
    return implementationDetails
      .map((step: any) => {
        let statusClass = "not-implemented";
        let statusIcon = "✗";

        if (step.implemented) {
          const hasMultipleImpls =
            step.hasMultipleImplementations ||
            (step.implementations && step.implementations.length > 1);

          if (hasMultipleImpls) {
            statusClass = "conflict";
            statusIcon = "⚠";
          } else {
            statusClass = "implemented";
            statusIcon = "✓";
          }
        }

        let implDetailsHtml = "";

        if (step.implemented) {
          const hasMultipleImpls =
            step.hasMultipleImplementations ||
            (step.implementations && step.implementations.length > 1);

          if (
            hasMultipleImpls &&
            step.implementations &&
            step.implementations.length > 0
          ) {
            implDetailsHtml += '<div class="multiple-impls">';

            step.implementations.forEach((impl: any, index: number) => {
              const fullPath = impl.file;
              const relativeFilePath = this.convertToRelativePath(fullPath);

              implDetailsHtml += `
                <div class="impl-item">
                  <div class="impl-file" data-file="${this.escapeHtml(fullPath)}" data-line="${impl.lineNumber}">
                    Implementation ${index + 1}: ${relativeFilePath}
                  </div>
                </div>
              `;
            });

            implDetailsHtml += "</div>";
          } else if (
            step.implementations &&
            step.implementations.length === 1
          ) {
            const impl = step.implementations[0];
            const relativeFilePath = this.convertToRelativePath(impl.file);

            implDetailsHtml += `
              <div class="impl-file" data-file="${this.escapeHtml(impl.file)}" data-line="${impl.lineNumber}">
                Implementation: ${relativeFilePath}
              </div>
            `;
          } else if (step.implementationFile) {
            const relativeFilePath = this.convertToRelativePath(
              step.implementationFile
            );

            implDetailsHtml += `
              <div class="impl-file" data-file="${this.escapeHtml(step.implementationFile)}" data-line="${step.implementationLine}">
                Implementation: ${relativeFilePath}
              </div>
            `;
          }
        }

        return `
        <div class="step ${statusClass}">
          <div class="status-icon">${statusIcon}</div>
          <div class="step-content">
            <div class="step-text">${this.escapeHtml(step.text)}</div>
            <div class="impl-details">
              ${implDetailsHtml}
            </div>
          </div>
        </div>`;
      })
      .join("");
  }

  /**
   * Build HTML for missing steps
   */
  public buildMissingStepsHtml(missingSteps: string[]): string {
    return missingSteps
      .map(
        (step) => `
        <div class="step not-implemented">
          <div class="status-icon">✗</div>
          <div class="step-content">
            <div class="step-text">${this.escapeHtml(step)}</div>
          </div>
        </div>
      `
      )
      .join("");
  }

  /**
   * Render automation details HTML
   */
  public renderAutomationDetails(
    scenarioName: string,
    stepsCount: number,
    implementedCount: number,
    notImplementedCount: number,
    stepsHtml: string
  ): string {
    const template = this.loadTemplate("automation-details.html");

    // Determine if scenario is fully automated
    const stepElements = stepsHtml.match(/<div class="step ([^"]+)">/g) || [];
    const hasConflicts = stepElements.some((step) =>
      step.includes("step conflict")
    );
    const isFullyAutomated =
      notImplementedCount === 0 && implementedCount > 0 && !hasConflicts;

    // Determine display label based on automation status
    const statusLabel = isFullyAutomated
      ? '<span class="status-badge automated">✓ Automated</span>'
      : '<span class="status-badge not-automated">○ Not Fully Automated</span>';

    // Replace placeholders with actual values
    return template
      .replace("{{STATUS_LABEL}}", statusLabel)
      .replace("{{SCENARIO_NAME}}", this.escapeHtml(scenarioName))
      .replace("{{STEPS_COUNT}}", stepsCount.toString())
      .replace("{{IMPLEMENTED_COUNT}}", implementedCount.toString())
      .replace("{{NOT_IMPLEMENTED_COUNT}}", notImplementedCount.toString())
      .replace("{{STEPS_HTML}}", stepsHtml);
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Clear template cache
   */
  public clearCache(): void {
    this.templateCache.clear();
  }
}
