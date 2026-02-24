// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { IXMindParserParameters } from "./interfaces";
import AdmZip from "adm-zip";
import * as xml2js from "xml2js";

/**
 * XMind mind map parsing tool
 */
export class XMindParser
  implements vscode.LanguageModelTool<IXMindParserParameters>
{
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IXMindParserParameters>,
    _token: vscode.CancellationToken
  ) {
    const params = options.input;
    const { xmindFilePath, outputFormat = "markdown", outputPath } = params;

    try {
      console.log(`Parsing XMind file: ${xmindFilePath}`);

      // Ensure XMind file path is provided
      if (!xmindFilePath) {
        throw new Error(
          "No XMind file path provided. Please include the path to the XMind file."
        );
      }

      // Check if file exists
      if (!fs.existsSync(xmindFilePath)) {
        throw new Error(`XMind file not found at path: ${xmindFilePath}`);
      }

      // Parse XMind file
      const parsedContent = await this.parseXMindFile(xmindFilePath);

      // Convert to requested format
      let formattedContent: string;
      if (outputFormat === "markdown") {
        // Use the new list-based markdown format for better hierarchy representation
        formattedContent = this.convertToMarkdownWithLists(parsedContent);
      } else {
        formattedContent = this.convertToPlainText(parsedContent);
      }

      console.log(
        `Successfully parsed XMind file with ${formattedContent.length} characters of content`
      );

      // Determine output file path
      let fileUri: vscode.Uri;
      if (outputPath) {
        fileUri = vscode.Uri.file(outputPath);
        console.log(`Using provided output path: ${outputPath}`);
      } else {
        // Create output file in the same directory as the input file, but with different extension
        const inputDir = path.dirname(xmindFilePath);
        const baseName = path.basename(
          xmindFilePath,
          path.extname(xmindFilePath)
        );
        const extension = outputFormat === "markdown" ? ".md" : ".txt";
        const outputFileName = `${baseName}_parsed${extension}`;
        fileUri = vscode.Uri.file(path.join(inputDir, outputFileName));
        console.log(`Using generated output path: ${fileUri.fsPath}`);
      }

      // Write to file
      try {
        console.log(`Writing to file: ${fileUri.fsPath}`);
        await vscode.workspace.fs.writeFile(
          fileUri,
          Buffer.from(formattedContent)
        );
        console.log(
          `Successfully wrote ${formattedContent.length} characters to file`
        );

        // Open file in editor
        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc);
        console.log(
          `File opened in editor: ${vscode.workspace.asRelativePath(fileUri)}`
        );

        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `✅ XMind file has been parsed and saved to "${vscode.workspace.asRelativePath(fileUri)}"\n\n` +
              `The content has been converted to ${outputFormat} format to make it readable by Copilot. ` +
              `The hierarchy and structure of the mindmap have been preserved.\n\n` +
              `You can now reference this file in your conversations with Copilot to discuss the content of the XMind file.`
          ),
        ]);
      } catch (error) {
        console.error(`Error writing file: ${error}`);
        throw new Error(
          `Failed to save parsed content: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Error parsing XMind file: ${errorMessage}`
        ),
      ]);
    }
  }

  private async parseXMindFile(filePath: string): Promise<any> {
    try {
      console.log(`Attempting to parse XMind file: ${filePath}`);

      // Try to read the entire file content
      const fileBuffer = await vscode.workspace.fs.readFile(
        vscode.Uri.file(filePath)
      );

      // Use adm-zip to parse XMind file
      try {
        console.log("Parsing XMind using adm-zip...");
        const zip = new AdmZip(Buffer.from(fileBuffer));

        // List all entries to help diagnose the file structure
        const entries = zip.getEntries();
        console.log(`Found ${entries.length} entries in the zip file:`);
        entries.forEach((entry) => console.log(`- ${entry.entryName}`));

        // Check for content.json first (XMind Zen format)
        const contentJsonEntry = zip.getEntry("content.json");
        if (contentJsonEntry) {
          console.log("Found content.json (XMind Zen format)");
          const contentJson = contentJsonEntry.getData().toString();
          try {
            const jsonData = JSON.parse(contentJson);
            console.log("Successfully parsed content.json");

            // Process XMind Zen format
            const parsedContent: any[] = [];

            if (Array.isArray(jsonData)) {
              // XMind Zen format typically has an array of sheets
              for (const sheet of jsonData) {
                if (sheet.rootTopic) {
                  const sheetData: any = {
                    title: sheet.title || "Untitled Sheet",
                    rootTopic: this.processJsonTopic(sheet.rootTopic),
                  };
                  parsedContent.push(sheetData);
                }
              }
            }

            if (parsedContent.length > 0) {
              return parsedContent;
            }
          } catch (jsonError) {
            console.log(
              `Failed to parse content.json: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`
            );
          }
        }

        // Try the traditional content.xml (older XMind format)
        const contentEntry = zip.getEntry("content.xml");
        if (contentEntry) {
          const contentXml = contentEntry.getData().toString();
          const parser = new xml2js.Parser({ explicitArray: false });
          const result = await new Promise<any>((resolve, reject) => {
            parser.parseString(contentXml, (err: any, result: any) => {
              if (err) {
                reject(err);
              } else {
                resolve(result);
              }
            });
          });
          console.log("Successfully parsed XMind content.xml");

          // Extract mind map structure
          const parsedContent: any[] = [];

          // Process all worksheets
          if (result && result.xmap && result.xmap.sheet) {
            // Ensure sheet is an array
            const sheets = Array.isArray(result.xmap.sheet)
              ? result.xmap.sheet
              : [result.xmap.sheet];

            for (const sheet of sheets) {
              const sheetData: any = {
                title: sheet.title || "Untitled Sheet",
                rootTopic: this.processXmlTopic(sheet.topic),
              };

              parsedContent.push(sheetData);
            }
          }

          return parsedContent;
        }

        // Try to find any JSON file that might contain the content
        for (const entry of entries) {
          if (entry.entryName.endsWith(".json")) {
            console.log(`Trying to parse JSON entry: ${entry.entryName}`);
            try {
              const jsonContent = entry.getData().toString();
              const jsonData = JSON.parse(jsonContent);

              // Check if this JSON might contain mind map data
              if (
                jsonData.rootTopic ||
                (Array.isArray(jsonData) &&
                  jsonData.length > 0 &&
                  jsonData[0].rootTopic)
              ) {
                console.log(
                  `Found potential mind map data in ${entry.entryName}`
                );
                const parsedContent =
                  this.convertJsonToStandardFormat(jsonData);
                if (parsedContent && parsedContent.length > 0) {
                  return parsedContent;
                }
              }
            } catch (err) {
              console.log(`Failed to parse ${entry.entryName}: ${err}`);
            }
          }
        }

        // If we reach here, no suitable content was found
        throw new Error(
          "Could not find compatible content structure in the XMind file"
        );
      } catch (error) {
        console.error("Error parsing XMind file:", error);
        throw new Error(
          `Failed to parse XMind file: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } catch (error) {
      console.error("Error parsing XMind file:", error);
      throw new Error(
        `Failed to parse XMind file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Add a new method to process JSON topics from XMind Zen format
  private processJsonTopic(topic: any): any {
    if (!topic) {
      return null;
    }

    const result: any = {
      title: topic.title || "Untitled Topic",
      notes: "",
      markers: [],
      labels: [],
      children: [],
    };

    // Extract notes
    if (topic.notes) {
      if (typeof topic.notes === "string") {
        result.notes = topic.notes;
      } else if (
        topic.notes.plain ||
        topic.notes.content ||
        topic.notes.plainText
      ) {
        result.notes =
          topic.notes.plain ||
          topic.notes.content ||
          topic.notes.plainText ||
          "";
      } else {
        result.notes = JSON.stringify(topic.notes);
      }
    }

    // Extract markers
    if (topic.markers && Array.isArray(topic.markers)) {
      result.markers = topic.markers.map((m: any) => {
        return typeof m === "string"
          ? m
          : m.id || m.markerId || JSON.stringify(m);
      });
    }

    // Extract labels
    if (topic.labels && Array.isArray(topic.labels)) {
      result.labels = topic.labels;
    }

    // Process children topics
    if (topic.children) {
      // Different formats of children
      if (Array.isArray(topic.children)) {
        // Direct array format
        for (const child of topic.children) {
          const processedChild = this.processJsonTopic(child);
          if (processedChild) {
            result.children.push(processedChild);
          }
        }
      } else if (typeof topic.children === "object") {
        // XMind Zen format: children can be organized by branch like "attached", "detached"
        for (const branchType in topic.children) {
          if (Array.isArray(topic.children[branchType])) {
            for (const child of topic.children[branchType]) {
              const processedChild = this.processJsonTopic(child);
              if (processedChild) {
                result.children.push(processedChild);
              }
            }
          }
        }
      }
    }

    return result;
  }

  private convertJsonToStandardFormat(jsonData: any): any[] {
    const parsedContent: any[] = [];

    if (Array.isArray(jsonData)) {
      // Handle array format (like in XMind Zen)
      for (const sheet of jsonData) {
        if (sheet.rootTopic) {
          const sheetData: any = {
            title: sheet.title || "Untitled Sheet",
            rootTopic: this.processJsonTopic(sheet.rootTopic),
          };
          parsedContent.push(sheetData);
        }
      }
    } else if (jsonData.rootTopic) {
      // Handle single sheet format
      const sheetData: any = {
        title: jsonData.title || "Untitled Sheet",
        rootTopic: this.processJsonTopic(jsonData.rootTopic),
      };
      parsedContent.push(sheetData);
    }

    return parsedContent;
  }

  private processXmlTopic(topic: any): any {
    if (!topic) {
      return null;
    }

    const result: any = {
      title: topic.title || "Untitled Topic",
      notes: "",
      markers: [],
      labels: [],
      children: [],
    }; // Extract notes content
    if (topic.notes) {
      if (topic.notes.plain) {
        result.notes = topic.notes.plain.content || "";
      } else if (typeof topic.notes === "string") {
        result.notes = topic.notes;
      }
    }

    // Extract markers
    if (topic.marker) {
      const markers = Array.isArray(topic.marker)
        ? topic.marker
        : [topic.marker];
      result.markers = markers
        .map((m: any) => m.id || String(m))
        .filter(Boolean);
    }

    // Extract labels
    if (topic.labels) {
      const labels = Array.isArray(topic.labels)
        ? topic.labels
        : [topic.labels];
      result.labels = labels
        .map((l: any) => (typeof l === "string" ? l : JSON.stringify(l)))
        .filter(Boolean);
    }

    // Process child topics
    if (topic.children && topic.children.topics) {
      const childTopics = topic.children.topics.topic;
      if (childTopics) {
        const childArray = Array.isArray(childTopics)
          ? childTopics
          : [childTopics];
        for (const child of childArray) {
          const processedChild = this.processXmlTopic(child);
          if (processedChild) {
            result.children.push(processedChild);
          }
        }
      }
    }

    return result;
  }

  private convertToMarkdown(parsedContent: any[]): string {
    let markdown = "# XMind Content\n\n";

    // Process each sheet
    for (let i = 0; i < parsedContent.length; i++) {
      const sheet = parsedContent[i];
      markdown += `## Sheet: ${sheet.title}\n\n`;

      // Process the root topic of this sheet
      if (sheet.rootTopic) {
        markdown += this.topicToMarkdown(sheet.rootTopic, 2);
      }

      // Add a separator between sheets (if not the last sheet)
      if (i < parsedContent.length - 1) {
        markdown += "\n---\n\n";
      }
    }

    return markdown;
  }

  private topicToMarkdown(topic: any, level: number): string {
    let markdown = "";

    // Create heading with proper level for the topic title
    markdown += `${"#".repeat(Math.min(level + 1, 6))} ${topic.title}\n\n`;

    // Add notes if they exist
    if (topic.notes) {
      markdown += `${topic.notes}\n\n`;
    }

    // Add markers and labels if they exist
    if (topic.markers && topic.markers.length > 0) {
      markdown += `**Markers:** ${topic.markers.join(", ")}\n\n`;
    }

    if (topic.labels && topic.labels.length > 0) {
      markdown += `**Labels:** ${topic.labels.join(", ")}\n\n`;
    }

    // Create a hierarchical structure for children
    if (topic.children && topic.children.length > 0) {
      // Process children topics recursively
      for (const child of topic.children) {
        markdown += this.topicToMarkdown(child, level + 1);
      }
    }

    return markdown;
  }

  // Alternative markdown format using lists for better hierarchy visualization
  private convertToMarkdownWithLists(parsedContent: any[]): string {
    let markdown = "# XMind Content\n\n";

    // Process each sheet
    for (let i = 0; i < parsedContent.length; i++) {
      const sheet = parsedContent[i];
      markdown += `## Sheet: ${sheet.title}\n\n`;

      // Process the root topic of this sheet
      if (sheet.rootTopic) {
        markdown += `### ${sheet.rootTopic.title}\n\n`;

        // Add root topic notes
        if (sheet.rootTopic.notes) {
          markdown += `${sheet.rootTopic.notes}\n\n`;
        }

        // Add children as hierarchical lists
        if (sheet.rootTopic.children && sheet.rootTopic.children.length > 0) {
          markdown += this.childrenToMarkdownList(sheet.rootTopic.children, 0);
        }
      }

      // Add a separator between sheets (if not the last sheet)
      if (i < parsedContent.length - 1) {
        markdown += "\n---\n\n";
      }
    }

    return markdown;
  }

  private childrenToMarkdownList(children: any[], indentLevel: number): string {
    let markdown = "";

    for (const child of children) {
      // Indent based on level
      const indent = "  ".repeat(indentLevel);

      // Add topic as list item with bold title
      markdown += `${indent}- **${child.title}**`;

      // Add notes as part of the list item
      if (child.notes) {
        // Ensure notes is a string before calling replace
        const notesText =
          typeof child.notes === "string" ? child.notes : String(child.notes);
        markdown += `\n${indent}  ${notesText.replace(/\n/g, `\n${indent}  `)}`;
      }

      markdown += "\n";

      // Add markers and labels if they exist
      if (child.markers && child.markers.length > 0) {
        markdown += `${indent}  *Markers: ${child.markers.join(", ")}*\n`;
      }

      if (child.labels && child.labels.length > 0) {
        markdown += `${indent}  *Labels: ${child.labels.join(", ")}*\n`;
      }

      // Process children recursively with increased indent
      if (child.children && child.children.length > 0) {
        markdown += this.childrenToMarkdownList(
          child.children,
          indentLevel + 1
        );
      }
    }

    return markdown;
  }

  private convertToPlainText(parsedContent: any[]): string {
    let text = "XMIND CONTENT\n\n";

    // Process each sheet
    for (let i = 0; i < parsedContent.length; i++) {
      const sheet = parsedContent[i];
      text += `SHEET: ${sheet.title}\n\n`;

      // Process the root topic of this sheet
      if (sheet.rootTopic) {
        text += this.topicToPlainText(sheet.rootTopic, 0);
      }

      // Add a separator between sheets (if not the last sheet)
      if (i < parsedContent.length - 1) {
        text += "\n----------\n\n";
      }
    }

    return text;
  }

  private topicToPlainText(topic: any, level: number): string {
    let text = "";
    const indent = "  ".repeat(level);

    // Create indented topic title
    text += `${indent}• ${topic.title}\n`;

    // Add notes if they exist (indented)
    if (topic.notes) {
      const notesIndent = "  ".repeat(level + 1);
      // Ensure notes is a string before calling replace
      const notesText =
        typeof topic.notes === "string" ? topic.notes : String(topic.notes);
      text += `${notesIndent}Notes: ${notesText.replace(/\n/g, `\n${notesIndent}`)}\n`;
    }

    // Add markers and labels if they exist (indented)
    if (topic.markers && topic.markers.length > 0) {
      const markersIndent = "  ".repeat(level + 1);
      text += `${markersIndent}Markers: ${topic.markers.join(", ")}\n`;
    }

    if (topic.labels && topic.labels.length > 0) {
      const labelsIndent = "  ".repeat(level + 1);
      text += `${labelsIndent}Labels: ${topic.labels.join(", ")}\n`;
    }

    // Add a newline after each topic and its metadata
    text += "\n";

    // Process children topics recursively
    if (topic.children && topic.children.length > 0) {
      for (const child of topic.children) {
        text += this.topicToPlainText(child, level + 1);
      }
    }

    return text;
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<IXMindParserParameters>,
    _token: vscode.CancellationToken
  ) {
    const { xmindFilePath, outputFormat = "markdown" } = options.input;

    const messageText =
      `Parse XMind file to ${outputFormat} format:\n\n` +
      `- XMind file: ${xmindFilePath}\n` +
      `- Output format: ${outputFormat}\n\n` +
      `This will convert the XMind file to a text format that Copilot can understand, ` +
      `preserving the hierarchy and content of the mindmap.`;

    return {
      invocationMessage: `Parsing XMind file for Copilot analysis`,
      confirmationMessages: {
        title: "Parse XMind File",
        message: new vscode.MarkdownString(messageText),
      },
    };
  }
}
