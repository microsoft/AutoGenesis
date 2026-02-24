// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/**
 * Loads the HTML template file and replaces placeholders with actual values
 *
 * @param webview The webview to get resources from
 * @param extensionUri The extension URI to resolve paths against
 * @param nonce Security nonce for script execution
 * @returns The HTML content with placeholders replaced
 */
export function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  nonce: string
): string {
  // Get the path to the HTML template
  const htmlTemplatePath = path.join(
    extensionUri.fsPath,
    "resources",
    "views",
    "setupView.html"
  );

  // Check if the template file exists
  if (!fs.existsSync(htmlTemplatePath)) {
    console.error(`HTML template not found at: ${htmlTemplatePath}`);
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>BDD AI Toolkit Setup</title>
        </head>
        <body>
          <h1>Error: Setup template not found</h1>
          <p>The setup view template file is missing. Please check your extension installation.</p>
        </body>
      </html>
    `;
  }

  // Read the HTML template
  let htmlContent = fs.readFileSync(htmlTemplatePath, "utf8");

  // Get URIs for CSS and JS files
  const cssUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "resources", "styles", "setupView.css")
  );
  const jsUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "resources", "scripts", "setupView.js")
  );

  // Replace placeholders in the HTML template
  htmlContent = htmlContent
    .replace(/{{cssUri}}/g, cssUri.toString())
    .replace(/{{jsUri}}/g, jsUri.toString())
    .replace(/{{nonce}}/g, nonce);

  return htmlContent;
}

/**
 * Generates a random nonce for CSP
 *
 * @returns A random nonce string
 */
export function generateNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
