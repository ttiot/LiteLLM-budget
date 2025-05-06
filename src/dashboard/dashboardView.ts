import * as vscode from 'vscode';

export class DashboardView {
    private static instance: DashboardView | undefined;
    private readonly _view: vscode.WebviewView | undefined;
    private readonly _extensionUri: vscode.Uri;

    private constructor(view: vscode.WebviewView, extensionUri: vscode.Uri) {
        this._view = view;
        this._extensionUri = extensionUri;
        this._initializeView();
    }

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new DashboardViewProvider(context.extensionUri);
        return vscode.window.registerWebviewViewProvider(DashboardViewProvider.viewType, provider);
    }

    private _initializeView(): void {
        if (this._view) {
            const webview = this._view.webview;
            webview.options = {
                enableScripts: true,
                localResourceRoots: [this._extensionUri]
            };
            webview.html = this._getHtmlForWebview();
        }
    }

    private _getHtmlForWebview(): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>LiteLLM Budget Dashboard</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    padding: 10px;
                }
                .dashboard-container {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .dashboard-header {
                    font-size: 1.2em;
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                .budget-summary {
                    background-color: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 5px;
                    padding: 15px;
                }
                .budget-info {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                }
                .progress-container {
                    width: 100%;
                    background-color: var(--vscode-input-background);
                    border-radius: 4px;
                    height: 8px;
                    margin-top: 10px;
                }
                .progress-bar {
                    height: 100%;
                    border-radius: 4px;
                    background-color: var(--vscode-progressBar-background);
                    width: 0%;
                }
            </style>
        </head>
        <body>
            <div class="dashboard-container">
                <div class="dashboard-header">LiteLLM Budget Dashboard</div>
                <div class="budget-summary">
                    <div class="budget-info">
                        <span>Dépenses actuelles:</span>
                        <span id="current-spend">Chargement...</span>
                    </div>
                    <div class="budget-info">
                        <span>Budget total:</span>
                        <span id="total-budget">Chargement...</span>
                    </div>
                    <div class="budget-info">
                        <span>Pourcentage utilisé:</span>
                        <span id="percentage-used">Chargement...</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar" id="budget-progress"></div>
                    </div>
                </div>
                <div class="placeholder-section">
                    <p>Les graphiques et l'historique détaillé seront disponibles dans les prochaines versions.</p>
                </div>
            </div>
            <script>
                (function() {
                    // Placeholder for future JavaScript functionality
                    // Will be implemented in future phases
                    const vscode = acquireVsCodeApi();
                    
                    // Listen for messages from the extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'update') {
                            updateDashboard(message.data);
                        }
                    });
                    
                    function updateDashboard(data) {
                        if (data) {
                            document.getElementById('current-spend').textContent = data.spend + '$';
                            document.getElementById('total-budget').textContent = data.maxBudget + '$';
                            document.getElementById('percentage-used').textContent = data.percentUsed + '%';
                            document.getElementById('budget-progress').style.width = data.percentUsed + '%';
                            
                            // Change color based on percentage
                            const progressBar = document.getElementById('budget-progress');
                            if (data.percentUsed < 50) {
                                progressBar.style.backgroundColor = 'var(--vscode-charts-green)';
                            } else if (data.percentUsed < 75) {
                                progressBar.style.backgroundColor = 'var(--vscode-charts-yellow)';
                            } else {
                                progressBar.style.backgroundColor = 'var(--vscode-charts-red)';
                            }
                        }
                    }
                    
                    // Signal that the webview is ready
                    vscode.postMessage({ type: 'ready' });
                })();
            </script>
        </body>
        </html>`;
    }

    public static updateDashboard(data: any): void {
        if (DashboardView.instance && DashboardView.instance._view) {
            DashboardView.instance._view.webview.postMessage({
                type: 'update',
                data
            });
        }
    }
}

export class DashboardViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'litellm.budgetDashboard';
    
    constructor(private readonly _extensionUri: vscode.Uri) {}
    
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        // Utiliser une méthode statique pour créer l'instance
        DashboardView['instance'] = new (DashboardView as any)(webviewView, this._extensionUri);
    }
}