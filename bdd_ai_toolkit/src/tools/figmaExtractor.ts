// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
// Add type declarations for axios
import axios from "axios";
// Add type declarations for js-yaml
import * as yaml from "js-yaml";
import { IFigmaExtractorParameters, toSafeFileName } from "./interfaces";

/**
 * Figma context extraction tool
 * Used to extract interaction logic and structure from Figma design files for test case generation
 */
export class FigmaExtractor
  implements vscode.LanguageModelTool<IFigmaExtractorParameters>
{
  // Figma API access token
  private async getFigmaToken(): Promise<string | undefined> {
    const config = vscode.workspace.getConfiguration("bddTestGenerator.figma");
    const token = config.get<string>("accessToken");

    if (!token) {
      const result = await vscode.window.showErrorMessage(
        "Figma access token not found. Please add it to VS Code settings.",
        "Open Settings"
      );

      if (result === "Open Settings") {
        await vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "bddTestGenerator.figma.accessToken"
        );
      }
    }

    return token;
  }

  // Save raw API data to file
  private async saveRawApiData(data: any, fileKey: string): Promise<string> {
    try {
      let outputFileName = "";

      // Determine output file path
      if (
        vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0
      ) {
        const rootFolder = vscode.workspace.workspaceFolders[0].uri;
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        outputFileName = `figma_api_raw_${fileKey}_${timestamp}.json`;
        const fileUri = vscode.Uri.joinPath(rootFolder, outputFileName);

        // Format JSON data for readability
        const formattedJson = JSON.stringify(data, null, 2);

        // Write to file
        await vscode.workspace.fs.writeFile(
          fileUri,
          Buffer.from(formattedJson)
        );
        console.log(`Raw Figma API data saved to: ${fileUri.fsPath}`);

        return outputFileName;
      } else {
        throw new Error("No workspace folder found");
      }
    } catch (error) {
      console.error(`Error saving raw API data:`, error);
      return "";
    }
  }

  // Get file data from Figma API
  private async getFigmaFile(
    fileKey: string,
    nodeId?: string,
    token?: string
  ): Promise<any> {
    try {
      if (!token) {
        throw new Error("No Figma access token provided");
      }

      // Build API URL
      let url = `https://api.figma.com/v1/files/${fileKey}`;
      if (nodeId) {
        url += `/nodes?ids=${nodeId}`;
      }

      console.log(`Calling Figma API: ${url}`);

      // Call Figma API
      const response = await axios.get(url, {
        headers: {
          "X-Figma-Token": token,
        },
      });

      console.log(`Figma API response status: ${response.status}`);

      // Check if data is returned
      if (!response.data) {
        throw new Error("Figma API returned empty response");
      }

      // Log response data top-level structure
      console.log(
        `Response data structure keys: ${Object.keys(response.data).join(", ")}`
      );

      return response.data;
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || error?.message || "Unknown error";
      console.error("Figma API error:", errorMessage);

      // If authorization error, provide clearer information
      if (error?.response?.status === 403) {
        throw new Error(
          `Figma API authorization failed: ${errorMessage}. Please check your access token.`
        );
      } else if (error?.response?.status === 404) {
        throw new Error(
          `Figma file not found: ${errorMessage}. Please check the file key.`
        );
      }

      throw new Error(`Failed to fetch Figma file: ${errorMessage}`);
    }
  }

  // Process node data and extract useful information
  private processNodes(data: any): any {
    console.log("Processing node data...");

    // Check data structure
    if (!data) {
      throw new Error("No data to process");
    }

    // If node request
    if (data.nodes) {
      console.log(
        `Found nodes data with ${Object.keys(data.nodes).length} nodes`
      );
      const nodeKeys = Object.keys(data.nodes);

      if (nodeKeys.length === 0) {
        throw new Error("No nodes found with the specified ID");
      }

      const firstNodeKey = nodeKeys[0];
      const nodeData = data.nodes[firstNodeKey];

      if (!nodeData || !nodeData.document) {
        throw new Error(`Invalid node data structure for node ${firstNodeKey}`);
      }

      console.log(
        `Processing node: ${nodeData.document.name} (${nodeData.document.type})`
      );
      return this.extractStructure(nodeData.document);
    }

    // If entire file request
    if (data.document) {
      console.log(
        `Processing document: ${data.document.name} (${data.document.type})`
      );
      return this.extractStructure(data.document);
    }

    // If data structure doesn't match expectations
    console.error(
      "Unexpected data structure:",
      JSON.stringify(data).substring(0, 200) + "..."
    );
    throw new Error("Unexpected Figma data structure");
  }

  // Extract node structure and interaction logic
  private extractStructure(node: any): any {
    if (!node) {
      return null;
    }

    // Basic node information
    const result: any = {
      id: node.id,
      name: node.name || "Unnamed",
      type: node.type || "Unknown",
    };

    // Handle component properties (such as variant properties)
    if (node.componentProperties) {
      result.componentProperties = node.componentProperties;
    }

    // Handle component references
    if (node.componentPropertyReferences) {
      result.properties = node.componentPropertyReferences;
    }

    // Handle text content
    if (node.characters) {
      result.text = node.characters;
    }

    // Handle visibility
    if (node.visible !== undefined) {
      result.visible = node.visible;
    }

    // Handle interaction events - extract only test case related information
    if (node.interactions && node.interactions.length > 0) {
      result.interactions = node.interactions.map((interaction: any) => {
        const interactionData: any = {
          trigger: interaction.trigger?.type || "Unknown",
        };

        // Extract action type
        if (interaction.actions && interaction.actions.length > 0) {
          const action = interaction.actions[0]; // Get first action
          interactionData.action = action.type;

          // Extract related data based on action type
          if (action.type === "NODE") {
            interactionData.targetNodeId = action.destinationId;
            interactionData.navigation = action.navigation;
          } else if (action.type === "URL") {
            // Extract URL action related information
            interactionData.url = action.url;
            interactionData.openInNewTab = action.openInNewTab;
          }
        }

        return interactionData;
      });
    }
    // Compatible with reactions field in original API structure
    else if (node.reactions && node.reactions.length > 0) {
      result.interactions = node.reactions.map((reaction: any) => {
        const interactionData: any = {
          trigger: reaction.trigger?.type || "Unknown",
          action: reaction.action?.type || "Unknown",
        };

        // Handle different types of actions
        if (reaction.action) {
          if (reaction.action.type === "NODE") {
            interactionData.targetNodeId = reaction.action.destinationId;
            interactionData.navigation = reaction.action.navigation;
          } else if (reaction.action.type === "URL") {
            interactionData.url = reaction.action.url;
            interactionData.openInNewTab = reaction.action.openInNewTab;
          }
        }

        return interactionData;
      });
    }

    // Handle prototype interaction links
    if (
      node.transitionNodeID &&
      (!result.interactions || result.interactions.length === 0)
    ) {
      result.interactions = [
        {
          trigger: "PROTOTYPE_TRIGGER",
          action: "NAVIGATE",
          targetNodeId: node.transitionNodeID,
        },
      ];
    }

    // Handle child nodes
    if (node.children && node.children.length > 0) {
      result.children = node.children
        .filter((child: any) => child) // Filter out null or undefined child nodes
        .map((child: any) => this.extractStructure(child))
        .filter((child: any) => child); // Filter out null results after extraction
    }

    return result;
  }

  // Convert data to YAML format
  private formatData(data: any): string {
    try {
      if (!data || Object.keys(data).length === 0) {
        throw new Error("No valid data to format");
      }

      // Use more robust YAML serialization settings
      return yaml.dump(data, {
        indent: 2,
        lineWidth: 120,
        noRefs: true, // Avoid reference markers
        noCompatMode: true,
      });
    } catch (error) {
      console.error("Error formatting data to YAML:", error);
      throw new Error(
        `Failed to format data to YAML: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Main execution function of the tool
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IFigmaExtractorParameters>,
    _token: vscode.CancellationToken
  ) {
    const params = options.input;
    const { fileKey, nodeId, outputPath } = params;

    try {
      console.log(
        `Extracting Figma context from file: ${fileKey}, node: ${nodeId || "entire file"}`
      );

      // Ensure file key is provided
      if (!fileKey) {
        throw new Error(
          "No Figma file key provided. Please include the fileKey parameter."
        );
      }

      // Get Figma access token
      const token = await this.getFigmaToken();
      if (!token) {
        throw new Error("Figma access token not found in settings.");
      }

      // Get data from Figma API
      const figmaData = await this.getFigmaFile(fileKey, nodeId, token);

      // Save raw API data to file
      const rawDataFilename = await this.saveRawApiData(figmaData, fileKey);

      // Process data
      const processedData = this.processNodes(figmaData);

      if (!processedData || Object.keys(processedData).length === 0) {
        throw new Error("Failed to extract meaningful data from Figma file");
      }

      console.log(
        `Successfully processed Figma data with ${processedData.children ? processedData.children.length : 0} top-level children`
      );

      // Format as YAML data
      const formattedData = this.formatData(processedData);

      if (!formattedData || formattedData === "{}") {
        throw new Error("Failed to generate valid YAML content");
      }

      console.log(
        `Generated YAML data of size: ${formattedData.length} characters`
      );

      // Determine output file path
      let fileUri: vscode.Uri;
      if (outputPath) {
        fileUri = vscode.Uri.file(outputPath);
        console.log(`Using provided output path: ${outputPath}`);
      } else {
        // Create output file in workspace
        if (
          vscode.workspace.workspaceFolders &&
          vscode.workspace.workspaceFolders.length > 0
        ) {
          const rootFolder = vscode.workspace.workspaceFolders[0].uri;
          const safeName = toSafeFileName(processedData.name || "figma_design");
          fileUri = vscode.Uri.joinPath(
            rootFolder,
            `${safeName}_figma_context.yaml`
          );
        } else {
          throw new Error(
            "No workspace folder found and no output path provided."
          );
        }
        console.log(`Using generated output path: ${fileUri.fsPath}`);
      }

      // Write to file
      try {
        await vscode.workspace.fs.writeFile(
          fileUri,
          Buffer.from(formattedData)
        );
        console.log(
          `Successfully wrote ${formattedData.length} characters to file: ${fileUri.fsPath}`
        );

        // Open file in editor
        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc);

        // Preview generated data structure
        const dataPreview = this.generateDataPreview(processedData);

        // Add raw data file information to result
        const rawDataMessage = rawDataFilename
          ? `\n\nRaw Figma API data has been saved to: "${rawDataFilename}" file for troubleshooting.`
          : "";

        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `✅ Figma context has been extracted and saved to "${vscode.workspace.asRelativePath(fileUri)}"\n\n` +
              `The design elements and interactions have been extracted from Figma and converted to YAML format.\n\n` +
              `${dataPreview}` +
              `${rawDataMessage}\n\n` +
              `This data can now be used to generate test cases based on the UI design.`
          ),
        ]);
      } catch (error) {
        console.error(`Error writing file:`, error);
        throw new Error(
          `Failed to save extracted Figma context: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error in Figma extraction:", errorMessage);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Error extracting Figma context: ${errorMessage}`
        ),
      ]);
    }
  }

  // Generate data preview with more detailed description of interactions
  private generateDataPreview(data: any): string {
    if (!data) {
      return "No data extracted";
    }

    let preview = `**Data Structure Preview:**\n\n`;
    preview += `- Document: \`${data.name}\` (${data.type})\n`;

    if (data.children && data.children.length > 0) {
      preview += `- Contains ${data.children.length} top-level elements\n`;
      preview += `- Element types: ${this.summarizeElementTypes(data.children)}\n`;
    }

    // Collect interaction information
    let interactionCount = 0;
    let urlActions = 0;
    let navigationActions = 0;

    this.countDetailedInteractions(data, (counts) => {
      interactionCount = counts.total;
      urlActions = counts.url;
      navigationActions = counts.navigation;
    });

    if (interactionCount > 0) {
      preview += `- Captured ${interactionCount} interaction${interactionCount > 1 ? "s" : ""}\n`;

      if (navigationActions > 0) {
        preview += `  - ${navigationActions} navigation action${navigationActions > 1 ? "s" : ""}\n`;
      }

      if (urlActions > 0) {
        preview += `  - ${urlActions} URL action${urlActions > 1 ? "s" : ""}\n`;
      }
    }

    return preview;
  }

  // Summarize element types
  private summarizeElementTypes(children: any[]): string {
    const types: Record<string, number> = {};

    const countTypes = (nodes: any[]) => {
      if (!nodes || !Array.isArray(nodes)) {
        return;
      }

      for (const node of nodes) {
        if (node && node.type) {
          types[node.type] = (types[node.type] || 0) + 1;
        }

        if (node.children && Array.isArray(node.children)) {
          countTypes(node.children);
        }
      }
    };

    countTypes(children);

    return Object.entries(types)
      .map(([type, count]) => `${type} (${count})`)
      .join(", ");
  }

  // Count interaction quantities and categorize
  private countDetailedInteractions(
    node: any,
    callback: (counts: {
      total: number;
      url: number;
      navigation: number;
    }) => void
  ) {
    const counts = {
      total: 0,
      url: 0,
      navigation: 0,
    };

    const traverse = (node: any) => {
      if (!node) {
        return;
      }
      if (node.interactions && Array.isArray(node.interactions)) {
        counts.total += node.interactions.length;

        // Count different types of interactions
        node.interactions.forEach((interaction: any) => {
          if (interaction.action === "URL" || interaction.url) {
            counts.url++;
          } else if (
            interaction.action === "NODE" ||
            interaction.action === "NAVIGATE" ||
            interaction.targetNodeId ||
            interaction.target
          ) {
            counts.navigation++;
          }
        });
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    traverse(node);
    callback(counts);
  }

  // Prepare display information before invocation
  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<IFigmaExtractorParameters>,
    _token: vscode.CancellationToken
  ) {
    const { fileKey, nodeId } = options.input;

    const nodeIdMsg = nodeId ? `Node ID: ${nodeId}` : "Entire file";

    const messageText =
      `Extract interaction logic from Figma design:\n\n` +
      `- Figma file key: ${fileKey}\n` +
      `- Scope: ${nodeIdMsg}\n` +
      `- Output format: YAML\n\n` +
      `This will extract the design structure, component hierarchy, and interaction logic ` +
      `from the Figma file to help generate comprehensive test cases.`;

    return {
      invocationMessage: `Extracting context from Figma design`,
      confirmationMessages: {
        title: "Extract Figma Context",
        message: new vscode.MarkdownString(messageText),
      },
    };
  }
}
