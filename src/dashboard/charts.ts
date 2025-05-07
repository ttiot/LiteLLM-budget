import { BudgetEntry } from '../storage/historyManager';

/**
 * Génère le code JavaScript pour initialiser un graphique d'évolution des dépenses
 * @param historyData Les données d'historique de budget
 * @param elementId L'ID de l'élément canvas où afficher le graphique
 * @returns Le code JavaScript pour créer le graphique
 */
export function generateSpendingChartScript(historyData: BudgetEntry[], elementId: string): string {
    // Formater les données pour Chart.js
    // const labels = historyData.map(entry => {
    //     const date = new Date(entry.timestamp);
    //     return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    // });
    const labels = historyData.map(entry => {
        const date = new Date(entry.timestamp);
        return new Intl.DateTimeFormat('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date).replace(',', '');
    });
    
    const spendData = historyData.map(entry => entry.spend);
    const percentData = historyData.map(entry => entry.percentUsed);
    
    return `
    // Créer le graphique d'évolution des dépenses
    const ctx = document.getElementById('${elementId}').getContext('2d');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ${JSON.stringify(labels)},
            datasets: [
                {
                    label: 'Dépenses ($)',
                    data: ${JSON.stringify(spendData)},
                    borderColor: 'var(--vscode-charts-blue)',
                    backgroundColor: 'rgba(0, 122, 204, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Pourcentage utilisé (%)',
                    data: ${JSON.stringify(percentData)},
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
    `;
}

/**
 * Génère le code HTML pour le conteneur du graphique
 * @param elementId L'ID à donner à l'élément canvas
 * @returns Le code HTML pour le conteneur du graphique
 */
export function generateChartContainer(elementId: string): string {
    return `
    <div class="chart-container">
        <div class="chart-header">
            <span class="header-title">Évolution des dépenses</span>
            <div class="chart-controls">
                <select id="period-selector" class="period-selector">
                    <option value="day">Jour</option>
                    <option value="week">Semaine</option>
                    <option value="month">Mois</option>
                    <option value="all" selected>Tout</option>
                </select>
            </div>
        </div>
        <div class="chart-wrapper">
            <canvas id="${elementId}"></canvas>
        </div>
    </div>
    `;
}

/**
 * Génère le code CSS pour les graphiques
 * @returns Le code CSS pour les graphiques
 */
export function generateChartStyles(): string {
    return `
    .chart-container {
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 5px;
        padding: 15px;
        margin-top: 20px;
    }
    
    .chart-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
    }
    
    .chart-controls {
        display: flex;
        gap: 10px;
    }
    
    .period-selector {
        background-color: var(--vscode-dropdown-background);
        color: var(--vscode-dropdown-foreground);
        border: 1px solid var(--vscode-dropdown-border);
        border-radius: 3px;
        padding: 4px 8px;
    }
    
    .chart-wrapper {
        height: 300px;
        position: relative;
    }
    
    .no-data-message {
        text-align: center;
        padding: 20px;
        color: var(--vscode-disabledForeground);
    }
    `;
}
