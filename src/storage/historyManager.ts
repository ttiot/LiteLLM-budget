import * as vscode from 'vscode';

export interface BudgetEntry {
    timestamp: number;
    spend: number;
    maxBudget: number;
    percentUsed: number;
}

export class HistoryManager {
    private static readonly HISTORY_KEY = 'litellm.budgetHistory';
    private static readonly MAX_ENTRIES = 100; // Limiter le nombre d'entrées pour éviter de surcharger le stockage

    /**
     * Ajoute une nouvelle entrée à l'historique des dépenses
     * @param context Le contexte d'extension VSCode
     * @param entry L'entrée de budget à ajouter
     */
    public static async addEntry(context: vscode.ExtensionContext, entry: BudgetEntry): Promise<void> {
        const history = await this.getHistory(context);
        
        // Ajouter la nouvelle entrée
        history.push(entry);
        
        // Limiter la taille de l'historique
        if (history.length > this.MAX_ENTRIES) {
            history.shift(); // Supprimer l'entrée la plus ancienne
        }
        
        // Sauvegarder l'historique mis à jour
        await context.globalState.update(this.HISTORY_KEY, history);
    }

    /**
     * Récupère l'historique complet des dépenses
     * @param context Le contexte d'extension VSCode
     * @returns Un tableau d'entrées de budget
     */
    public static async getHistory(context: vscode.ExtensionContext): Promise<BudgetEntry[]> {
        const history = context.globalState.get<BudgetEntry[]>(this.HISTORY_KEY);
        return history || [];
    }

    /**
     * Récupère l'historique filtré par période
     * @param context Le contexte d'extension VSCode
     * @param period La période de filtrage ('day', 'week', 'month', 'all')
     * @returns Un tableau d'entrées de budget filtré
     */
    public static async getFilteredHistory(
        context: vscode.ExtensionContext,
        period: 'day' | 'week' | 'month' | 'all' = 'all'
    ): Promise<BudgetEntry[]> {
        const history = await this.getHistory(context);
        const now = Date.now();
        
        if (period === 'all') {
            return history;
        }
        
        // Calculer la date limite en fonction de la période
        let cutoffTime: number;
        switch (period) {
            case 'day':
                cutoffTime = now - 24 * 60 * 60 * 1000; // 24 heures
                break;
            case 'week':
                cutoffTime = now - 7 * 24 * 60 * 60 * 1000; // 7 jours
                break;
            case 'month':
                cutoffTime = now - 30 * 24 * 60 * 60 * 1000; // 30 jours
                break;
            default:
                cutoffTime = 0;
        }
        
        // Filtrer l'historique
        return history.filter(entry => entry.timestamp >= cutoffTime);
    }

    /**
     * Efface tout l'historique des dépenses
     * @param context Le contexte d'extension VSCode
     */
    public static async clearHistory(context: vscode.ExtensionContext): Promise<void> {
        await context.globalState.update(this.HISTORY_KEY, []);
    }
}