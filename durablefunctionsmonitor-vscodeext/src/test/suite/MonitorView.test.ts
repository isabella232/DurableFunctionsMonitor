// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';
import * as vscode from 'vscode';

import { MonitorView } from '../../MonitorView';
import { Settings } from "../../Settings";

suite('MonitorView Test Suite', () => {

	const testTimeoutInMs = 60000;

	test('Shows the WebView', async () => {

		// Arrange

		const webViewState = {
			myKey: new Date().toISOString()
		};

		const context: any = {

			globalState: {
				get: () => webViewState
			}
		};

		const backend: any = {

			getBackend: () => Promise.resolve(),

			storageConnectionStrings: [
				Settings().storageEmulatorConnectionString
			],

			binariesFolder: path.join(__dirname, '..', '..', '..', '..', 'durablefunctionsmonitor.dotnetbackend')
		};

		Object.defineProperty(vscode.workspace, 'rootPath', { get: () => backend.binariesFolder });
		
		const functionGraphList: any = {};

		const monitorView = new MonitorView(context, backend, 'my-hub', functionGraphList, () => { });

		var iAmReadyMessageSent = false;

		// Act

		await monitorView.show();

		// Assert

		const webViewPanel: vscode.WebviewPanel = (monitorView as any)._webViewPanel;

		(monitorView as any).handleMessageFromWebView = (webView: vscode.Webview, request: any, messageToWebView: any) => {

			if (webView === webViewPanel.webview && request.method === 'IAmReady') {
				iAmReadyMessageSent = true;
			}
		};

		// Waiting for the webView to send a message
		await new Promise<void>((resolve) => setTimeout(resolve, 1000));

		assert.strictEqual(monitorView.isVisible, true);
		assert.strictEqual(iAmReadyMessageSent, true);

		const html = webViewPanel.webview.html;

		// Checking embedded constants
		const stateFromVsCodeScript = `<script>var OrchestrationIdFromVsCode="",StateFromVsCode=${JSON.stringify(webViewState)}</script>`;
		assert.strictEqual(html.includes(stateFromVsCodeScript), true);

		const dfmClientConfigScript = `<script>var DfmClientConfig={'theme':'light','showTimeAs':'UTC'}</script>`;
		assert.strictEqual(html.includes(dfmClientConfigScript), true);

		const dfmViewModeScript = `<script>var DfmViewMode=0</script>`;
		assert.strictEqual(html.includes(dfmViewModeScript), true);

		const isFunctionGraphAvailableScript = `<script>var IsFunctionGraphAvailable=1</script>`;
		assert.strictEqual(html.includes(isFunctionGraphAvailableScript), true);

		// Checking links
		const linkToManifestJson = webViewPanel.webview.asWebviewUri(vscode.Uri.file(path.join(backend.binariesFolder, 'DfmStatics', 'manifest.json')));
		assert.strictEqual(html.includes(`href="${linkToManifestJson}"`), true);

		const linkToFavicon = webViewPanel.webview.asWebviewUri(vscode.Uri.file(path.join(backend.binariesFolder, 'DfmStatics', 'favicon.png')));
		assert.strictEqual(html.includes(`href="${linkToFavicon}"`), true);

		const cssFolder = path.join(backend.binariesFolder, 'DfmStatics', 'static', 'css');
		for (const fileName of await fs.promises.readdir(cssFolder)) {

			if (path.extname(fileName).toLowerCase() === '.css') {

				const linkToCss = webViewPanel.webview.asWebviewUri(vscode.Uri.file(path.join(cssFolder, fileName)));
				assert.strictEqual(html.includes(`href="${linkToCss}"`), true);
			}
		}

		const jsFolder = path.join(backend.binariesFolder, 'DfmStatics', 'static', 'js');
		for (const fileName of await fs.promises.readdir(jsFolder)) {

			if ( !fileName.startsWith('runtime-main.') && path.extname(fileName).toLowerCase() === '.js') {

				const linkToJs = webViewPanel.webview.asWebviewUri(vscode.Uri.file(path.join(jsFolder, fileName)));
				assert.strictEqual(html.includes(`src="${linkToJs}"`), true);
			}
		}

		monitorView.cleanup();

	}).timeout(testTimeoutInMs);

	test('Handles IAmReady', async () => {

		// Arrange

		const context: any = {};
		const backend: any = {};
		const functionGraphList: any = {};

		const msgToWebView = 'just-a-message';
		var msgWasSent = false;
		const webView: any = {

			postMessage: (msg: any) => {

				if (msg === msgToWebView) {
					msgWasSent = true;
				}
			}
		};

		const request: any = {

			method: 'IAmReady'
		};

		const monitorView = new MonitorView(context, backend, 'my-hub', functionGraphList, () => { });

		// Act

		(monitorView as any).handleMessageFromWebView(webView, request, msgToWebView);

		// Assert

		assert.strictEqual(msgWasSent, true);
	});	

	test('Handles PersistState', async () => {

		// Arrange

		const globalStateName = 'durableFunctionsMonitorWebViewState';
		const globalState = {
			someOtherField: new Date()
		};
		const stateFieldKey = 'my-field-key';
		const stateFieldValue = 'my-field-value';
		
		var stateWasUpdated = false;

		const context: any = {

			globalState: {

				get: (name: string) => {

					assert.strictEqual(name, globalStateName);

					return globalState;
				},

				update: (name: string, value: any) => {

					assert.strictEqual(name, globalStateName);
					assert.strictEqual(value.someOtherField, globalState.someOtherField);
					assert.strictEqual(value[stateFieldKey], stateFieldValue);

					stateWasUpdated = true;
				}
			}
		};

		const backend: any = {};
		const functionGraphList: any = {};
		const webView: any = {};

		const request: any = {
			method: 'PersistState',
			key: stateFieldKey,
			data: stateFieldValue
		};

		const monitorView = new MonitorView(context, backend, 'my-hub', functionGraphList, () => { });

		// Act

		(monitorView as any).handleMessageFromWebView(webView, request);

		// Assert

		assert.strictEqual(stateWasUpdated, true);
	});	

	test('Handles OpenInNewWindow', async () => {

		// Arrange

		const globalState = {};
		
		const context: any = {

			globalState: {
				get: () => globalState
			}
		};

		const backend: any = {

			getBackend: () => Promise.resolve(),

			storageConnectionStrings: [
				Settings().storageEmulatorConnectionString
			],

			binariesFolder: path.join(__dirname, '..', '..', '..', '..', 'durablefunctionsmonitor.dotnetbackend')
		};
		
		const functionGraphList: any = {};
		const webView: any = {};

		const orchestrationId = new Date().toISOString();

		const request: any = {
			method: 'OpenInNewWindow',
			url: orchestrationId
		};

		const monitorView = new MonitorView(context, backend, 'my-hub', functionGraphList, () => { });

		// Act

		(monitorView as any).handleMessageFromWebView(webView, request);

		// Assert

		const childWebViewPanels: vscode.WebviewPanel[] = (monitorView as any)._childWebViewPanels;

		assert.strictEqual(childWebViewPanels.length, 1);

		const viewPanel = childWebViewPanels[0];

		assert.strictEqual(viewPanel.title, `Instance '${orchestrationId}'`);

		const html = viewPanel.webview.html;
		const stateFromVsCodeScript = `<script>var OrchestrationIdFromVsCode="${orchestrationId}",StateFromVsCode={}</script>`;
		assert.strictEqual(html.includes(stateFromVsCodeScript), true);

	}).timeout(testTimeoutInMs);

	test('Handles SaveAs', async () => {

		// Arrange

		const context: any = {};
		const backend: any = {};
		const functionGraphList: any = {};
		const webView: any = {};

		const svgFileName = `dfm-test-svg-${new Date().valueOf().toString()}.svg`;
		const svgFilePath = path.join(os.tmpdir(), svgFileName);

		const request: any = {

			method: 'SaveAs',
			data: `<svg id="${svgFileName}"></svg>`
		};

		const monitorView = new MonitorView(context, backend, 'my-hub', functionGraphList, () => { });

		(vscode.window as any).showSaveDialog = (options: vscode.SaveDialogOptions) => {

			const filters = options.filters!;
			assert.strictEqual(filters['SVG Images'].length, 1);
			assert.strictEqual(filters['SVG Images'][0], 'svg');

			return Promise.resolve({ fsPath: svgFilePath });
		};

		// Act

		(monitorView as any).handleMessageFromWebView(webView, request);

		await new Promise<void>((resolve) => setTimeout(resolve, 100));

		// Assert

		const svg = await fs.promises.readFile(svgFilePath, { encoding: 'utf8' });

		await fs.promises.rm(svgFilePath);

		assert.strictEqual(svg, request.data);

	});	

});
