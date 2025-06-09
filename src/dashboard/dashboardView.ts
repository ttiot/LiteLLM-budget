import * as vscode from 'vscode';
import { BudgetEntry, HistoryManager } from '../storage/historyManager';
import { generateChartContainer, generateChartStyles } from './charts';

export class DashboardView {
    private static instance: DashboardView | undefined;
    private readonly _view: vscode.WebviewView | undefined;
    private readonly _extensionUri: vscode.Uri;
    private static pendingData: any = null;
    private static isReady: boolean = false;
    private static extensionContext: vscode.ExtensionContext;
    private static currentPeriod: 'day' | 'week' | 'month' | 'all' = 'all';

    private constructor(view: vscode.WebviewView, extensionUri: vscode.Uri) {
        this._view = view;
        this._extensionUri = extensionUri;
        this._initializeView();
        
        // Configurer l'écouteur de messages
        if (this._view) {
            // Écouter les messages du webview
            this._view.webview.onDidReceiveMessage(message => {
                if (message.type === 'ready') {
                    DashboardView.isReady = true;
                    
                    // Envoyer les données en attente si elles existent
                    if (DashboardView.pendingData && this._view) {
                        this._view.webview.postMessage({
                            type: 'update',
                            data: DashboardView.pendingData
                        });
                        DashboardView.pendingData = null;
                    }
                    
                    // Envoyer l'historique initial
                    this._sendHistoryData();
                } else if (message.type === 'refresh') {
                    // Exécuter la commande de mise à jour du tableau de bord
                    vscode.commands.executeCommand('litellm.updateDashboard');
                } else if (message.type === 'period-change') {
                    // Mettre à jour la période et envoyer les nouvelles données
                    DashboardView.currentPeriod = message.period;
                    this._sendHistoryData();
                }
            });
            
            // Écouter les changements de visibilité
            this._view.onDidChangeVisibility(() => {
                // Vérifier que this._view n'est pas undefined
                if (this._view && this._view.visible) {
                    // Forcer une mise à jour lorsque la vue devient visible
                    if (DashboardView.pendingData) {
                        this._view.webview.postMessage({
                            type: 'update',
                            data: DashboardView.pendingData
                        });
                    }
                    
                    // Mettre à jour l'historique
                    this._sendHistoryData();
                }
            });
        }
    }

    private async _sendHistoryData(): Promise<void> {
        if (!this._view || !this._view.visible) {
            return;
        }
        
        try {
            // Récupérer l'historique filtré
            const historyData = await HistoryManager.getFilteredHistory(
                DashboardView.extensionContext,
                DashboardView.currentPeriod
            );
            
            // Envoyer les données au webview
            this._view.webview.postMessage({
                type: 'history',
                data: historyData
            });
        } catch (error) {
            console.error('Erreur lors de la récupération de l\'historique:', error);
        }
    }

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        DashboardView.extensionContext = context;
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
            <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
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
                .budget-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }
                .header-title {
                    font-weight: bold;
                }
                .refresh-button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 4px 8px;
                    border-radius: 3px;
                    cursor: pointer;
                }
                .refresh-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
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
                ${generateChartStyles()}
            </style>
        </head>
        <body>
            <div class="dashboard-container">
                <div class="dashboard-header">LiteLLM Budget Dashboard</div>
                <div class="budget-summary">
                    <div class="budget-header">
                        <span class="header-title">Résumé du budget</span>
                        <button class="refresh-button" id="refresh-button">Rafraîchir</button>
                    </div>
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
                    <div class="budget-info">
                        <span>Réinitialisation:</span>
                        <span id="reset-at">Chargement...</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar" id="budget-progress"></div>
                    </div>
                </div>
                
                ${generateChartContainer('spending-chart')}
            </div>
            <script>
                (function() {
                    const vscode = acquireVsCodeApi();
                    let chart = null;
                    let historyData = [];
                    
                    // Listen for messages from the extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'update') {
                            updateDashboard(message.data);
                        } else if (message.type === 'history') {
                            updateChart(message.data);
                        }
                    });
                    
                    function updateDashboard(data) {
                        if (data) {
                            document.getElementById('current-spend').textContent = data.spend + '$';
                            document.getElementById('total-budget').textContent = data.maxBudget + '$';
                            document.getElementById('percentage-used').textContent = data.percentUsed + '%';
                            document.getElementById('reset-at').textContent = data.resetAt || 'Non défini';
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
                    
                    function updateChart(data) {
                        historyData = data;
                        
                        // Si aucune donnée, afficher un message
                        const chartWrapper = document.querySelector('.chart-wrapper');
                        if (!data || data.length === 0) {
                            chartWrapper.innerHTML = '<div class="no-data-message">Aucune donnée disponible pour cette période</div>';
                            return;
                        }
                        
                        // S'assurer que le canvas existe
                        if (!document.getElementById('spending-chart')) {
                            chartWrapper.innerHTML = '<canvas id="spending-chart"></canvas>';
                        }
                        
                        // Détruire le graphique existant s'il y en a un
                        if (chart) {
                            chart.destroy();
                        }
                        
                        // Créer le nouveau graphique
                        const ctx = document.getElementById('spending-chart').getContext('2d');
                        
                        // Formater les données pour Chart.js
                        const labels = historyData.map(entry => {
                            const date = new Date(entry.timestamp);
                            return new Intl.DateTimeFormat('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                            }).format(date).replace(',', '');
                        });
                        
                        const spendData = data.map(entry => entry.spend);
                        const percentData = data.map(entry => entry.percentUsed);
                        
                        chart = new Chart(ctx, {
                            type: 'line',
                            data: {
                                labels: labels,
                                datasets: [
                                    {
                                        label: 'Dépenses ($)',
                                        data: spendData,
                                        borderColor: 'var(--vscode-charts-blue)',
                                        backgroundColor: 'rgba(0, 122, 204, 0.1)',
                                        borderWidth: 2,
                                        fill: true,
                                        tension: 0.4,
                                        yAxisID: 'y'
                                    },
                                    {
                                        label: 'Pourcentage utilisé (%)',
                                        data: percentData,
                                        borderColor: 'var(--vscode-charts-orange)',
                                        backgroundColor: 'transparent',
                                        borderWidth: 2,
                                        borderDash: [5, 5],
                                        tension: 0.4,
                                        yAxisID: 'y1'
                                    }
                                ]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                interaction: {
                                    mode: 'index',
                                    intersect: false,
                                },
                                plugins: {
                                    legend: {
                                        position: 'top',
                                        labels: {
                                            color: 'var(--vscode-foreground)'
                                        }
                                    },
                                    tooltip: {
                                        backgroundColor: 'rgba(50, 50, 50, 0.9)',
                                        titleColor: 'rgba(255, 255, 255, 0.9)',
                                        bodyColor: 'rgba(255, 255, 255, 0.9)',
                                        borderColor: 'var(--vscode-panel-border)',
                                        borderWidth: 1,
                                        padding: 10
                                    }
                                },
                                scales: {
                                    x: {
                                        ticks: {
                                            color: 'var(--vscode-foreground)'
                                        },
                                        grid: {
                                            color: 'var(--vscode-panel-border)',
                                            borderColor: 'var(--vscode-panel-border)'
                                        }
                                    },
                                    y: {
                                        type: 'linear',
                                        display: true,
                                        position: 'left',
                                        title: {
                                            display: true,
                                            text: 'Dépenses ($)',
                                            color: 'var(--vscode-foreground)'
                                        },
                                        ticks: {
                                            color: 'var(--vscode-foreground)'
                                        },
                                        grid: {
                                            color: 'var(--vscode-panel-border)',
                                            borderColor: 'var(--vscode-panel-border)'
                                        }
                                    },
                                    y1: {
                                        type: 'linear',
                                        display: true,
                                        position: 'right',
                                        title: {
                                            display: true,
                                            text: 'Pourcentage (%)',
                                            color: 'var(--vscode-foreground)'
                                        },
                                        min: 0,
                                        max: 100,
                                        ticks: {
                                            color: 'var(--vscode-foreground)'
                                        },
                                        grid: {
                                            drawOnChartArea: false,
                                            color: 'var(--vscode-panel-border)',
                                            borderColor: 'var(--vscode-panel-border)'
                                        }
                                    }
                                }
                            }
                        });
                    }
                    
                    // Ajouter un gestionnaire d'événements pour le bouton de rafraîchissement
                    document.getElementById('refresh-button').addEventListener('click', () => {
                        // Mettre à jour le texte du bouton pour indiquer le chargement
                        const refreshButton = document.getElementById('refresh-button');
                        const originalText = refreshButton.textContent;
                        refreshButton.textContent = 'Chargement...';
                        refreshButton.disabled = true;
                        
                        // Demander une mise à jour au backend
                        vscode.postMessage({ type: 'refresh' });
                        
                        // Rétablir le texte du bouton après un court délai
                        setTimeout(() => {
                            refreshButton.textContent = originalText;
                            refreshButton.disabled = false;
                        }, 2000);
                    });
                    
                    // Ajouter un gestionnaire d'événements pour le sélecteur de période
                    document.getElementById('period-selector').addEventListener('change', (event) => {
                        vscode.postMessage({
                            type: 'period-change',
                            period: event.target.value
                        });
                    });
                    
                    // Signal that the webview is ready
                    vscode.postMessage({ type: 'ready' });
                })();
            </script>
        </body>
        </html>`;
    }

    public static async updateDashboard(data: any): Promise<void> {
        // Stocker les données pour une utilisation ultérieure si le webview n'est pas prêt
        if (!DashboardView.isReady || !DashboardView.instance || !DashboardView.instance._view) {
            DashboardView.pendingData = data;
            return;
        }
        
        // Enregistrer les données dans l'historique
        if (DashboardView.extensionContext) {
            const budgetEntry: BudgetEntry = {
                timestamp: Date.now(),
                spend: data.spend,
                maxBudget: data.maxBudget,
                percentUsed: data.percentUsed
            };
            
            await HistoryManager.addEntry(DashboardView.extensionContext, budgetEntry);
            
            // Mettre à jour le graphique si la vue est visible
            if (DashboardView.instance._view && DashboardView.instance._view.visible) {
                await DashboardView.instance._sendHistoryData();
            }
        }
        
        // Envoyer les données au webview
        DashboardView.instance._view.webview.postMessage({
            type: 'update',
            data
        });
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