import fetch from 'node-fetch';
import * as vscode from 'vscode';
import { DashboardView, DashboardViewProvider } from './dashboard/dashboardView';

export async function activate(context: vscode.ExtensionContext) {
    // Enregistrer la vue du tableau de bord
    context.subscriptions.push(DashboardView.register(context));

    // Command to open extension settings
    const openSettingsCommand = 'litellm.openSettings';
    context.subscriptions.push(vscode.commands.registerCommand(openSettingsCommand, () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'LiteLLM');
    }));

    // Command to open dashboard
    const openDashboardCommand = 'litellm.openDashboard';
    context.subscriptions.push(vscode.commands.registerCommand(openDashboardCommand, () => {
        vscode.commands.executeCommand('workbench.view.extension.litellm-budget');
    }));

    // Command to refresh budget information
    const refreshBudgetCommand = 'litellm.refreshBudget';
    context.subscriptions.push(vscode.commands.registerCommand(refreshBudgetCommand, () => {
        updateStatusBar();
        vscode.window.showInformationMessage(vscode.l10n.t('Budget information refreshed'));
    }));
    
    // Command to force dashboard update
    const updateDashboardCommand = 'litellm.updateDashboard';
    context.subscriptions.push(vscode.commands.registerCommand(updateDashboardCommand, async () => {
        const { apiKey, apiUrl } = await getConfigValues();
        if (!apiKey) {
            return;
        }
        
        try {
            const response = await fetch(`${apiUrl}/key/info`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                },
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            
            const data = await response.json();
            const spend = data.info.spend ?? 0;
            const max_budget = data.info.max_budget ?? 0;
            const spendRounded = Math.round(spend * 100) / 100;
            const percent_used = max_budget > 0 ? Math.round((spendRounded / max_budget) * 100) : 0;
            
            // Mettre à jour le tableau de bord
            DashboardView.updateDashboard({
                spend: spendRounded,
                maxBudget: max_budget,
                percentUsed: percent_used
            });
            
            vscode.window.showInformationMessage(vscode.l10n.t('Dashboard updated'));
        } catch (error) {
            vscode.window.showErrorMessage(vscode.l10n.t('Failed to update dashboard'));
        }
    }));

    // Command to display the budget context menu
    const showBudgetMenuCommand = 'litellm.showBudgetMenu';
    context.subscriptions.push(vscode.commands.registerCommand(showBudgetMenuCommand, async (spend: number, maxBudget: number) => {
        // Create a QuickPick to display a lightweight menu with options
        const items: vscode.QuickPickItem[] = [
            {
                label: vscode.l10n.t("$(sync) Refresh"),
                description: vscode.l10n.t("Update budget information")
            },
            {
                label: vscode.l10n.t("$(gear) Settings"),
                description: vscode.l10n.t("Open extension settings")
            },
            {
                label: vscode.l10n.t("$(graph) Details"),
                description: vscode.l10n.t("Spent: ${0}$ / Total budget: ${1}$",spend, maxBudget)
            },
            {
                label: vscode.l10n.t("$(dashboard) Dashboard"),
                description: vscode.l10n.t("Open budget dashboard")
            }
        ];

        const selectedItem = await vscode.window.showQuickPick(items, {
            placeHolder: vscode.l10n.t("Budget: ${0}$ / ${1}$", spend, maxBudget),
            title: vscode.l10n.t("Budget Details")
        });

        if (selectedItem) {
            if (selectedItem.label.includes("Refresh")) {
                vscode.commands.executeCommand('litellm.refreshBudget');
            } else if (selectedItem.label.includes("Settings")) {
                vscode.commands.executeCommand('litellm.openSettings');
            } else if (selectedItem.label.includes("Dashboard")) {
                vscode.commands.executeCommand('litellm.openDashboard');
            }
        }
    }));

    // Creating a status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = vscode.l10n.t("Budget: Loading...");
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

	// Function to retrieve user settings
	const getConfigValues = async () => {
	    const config = vscode.workspace.getConfiguration('LiteLLM');
		const secrets: vscode.SecretStorage = context.secrets;

        let apiKey = await secrets.get("apiKey");
        if (!apiKey) {
            apiKey = await vscode.window.showInputBox({ title: vscode.l10n.t('Enter your API token'), password: true });
            if (apiKey !== undefined) {
                await secrets.store('apiKey',apiKey);
            }
        }
        const refreshInterval = config.get<number>('refreshInterval') || 60;
        const apiUrl = config.get<string>('apiUrl') || 'https://';
        return { apiKey, refreshInterval, apiUrl };
    };

    // Function to generate a progress bar with Unicode characters
    const generateProgressBar = (percentage: number, length: number = 10): string => {
        const filledLength = Math.round(percentage * length / 100);
        const emptyLength = length - filledLength;
        
        // Unicode characters for the progress bar
        const filled = '█';
        const empty = '░';
        
        return filled.repeat(filledLength) + empty.repeat(emptyLength);
    };

    // Function to get color based on percentage
    const getColorForPercentage = (percentage: number, theme: string): string => {
        if (theme === 'traffic') {
            if (percentage < 50) return 'green';
            if (percentage < 75) return 'yellow';
            return 'red';
        } else if (theme === 'gradient') {
            if (percentage < 33) return 'green';
            if (percentage < 66) return 'blue';
            if (percentage < 90) return 'yellow';
            return 'red';
        } else {
            // Default theme
            if (percentage < 50) return '';
            if (percentage < 75) return 'yellow';
            return 'red';
        }
    };

    // Function to check if a threshold has been crossed
    const checkThresholds = (percentage: number, thresholds: any, lastNotifiedThreshold: number): number => {
        let notifiedThreshold = lastNotifiedThreshold;
        const config = vscode.workspace.getConfiguration('LiteLLM');
        const enableNotifications = config.get<boolean>('enableNotifications') ?? true;
        
        if (!enableNotifications) {
            return notifiedThreshold;
        }
        
        if (percentage >= thresholds.danger && lastNotifiedThreshold < thresholds.danger) {
            vscode.window.showWarningMessage(vscode.l10n.t('Budget alert: {0}% of your budget has been used!', percentage));
            notifiedThreshold = thresholds.danger;
        } else if (percentage >= thresholds.critical && lastNotifiedThreshold < thresholds.critical) {
            vscode.window.showWarningMessage(vscode.l10n.t('Budget warning: {0}% of your budget has been used!', percentage));
            notifiedThreshold = thresholds.critical;
        } else if (percentage >= thresholds.warning && lastNotifiedThreshold < thresholds.warning) {
            vscode.window.showInformationMessage(vscode.l10n.t('Budget notice: {0}% of your budget has been used.', percentage));
            notifiedThreshold = thresholds.warning;
        }
        
        return notifiedThreshold;
    };

    // Store the last notified threshold to avoid repeated notifications
    let lastNotifiedThreshold = 0;

    // Function to update the status bar
    const updateStatusBar = async () => {
        const { apiKey, apiUrl } = await getConfigValues(); // Retrieve API key and URL
        const config = vscode.workspace.getConfiguration('LiteLLM');
        const displayFormat = config.get<string>('displayFormat') ?? 'progressBar';
        const colorTheme = config.get<string>('colorTheme') ?? 'gradient';
        const showIcon = config.get<boolean>('showIcon') ?? true;
        const thresholds = config.get<any>('thresholds') ?? { warning: 50, critical: 75, danger: 90 };

        if (!apiKey ) {
            statusBarItem.text = vscode.l10n.t("Budget: Missing key");
            statusBarItem.tooltip = vscode.l10n.t("Please configure your API key in settings\nClick to open settings");
            statusBarItem.command = 'litellm.openSettings';
            return;
        }

        try {
            const response = await fetch(`${apiUrl}/key/info`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const data = await response.json();
            const spend = data.info.spend ?? 0;
            const max_budget = data.info.max_budget ?? 0;

            // Round the `spend` to the nearest hundredth
            const spendRounded = Math.round(spend * 100) / 100;
            
            // Calculate percentage used
            let percent_used = max_budget > 0 ? Math.round((spendRounded / max_budget) * 100) : 0;
            
            // Check if any threshold has been crossed
            lastNotifiedThreshold = checkThresholds(percent_used, thresholds, lastNotifiedThreshold);
            
            // Get color based on percentage
            const color = getColorForPercentage(percent_used, colorTheme);
            
            // Update the status bar text based on display format
            const icon = showIcon ? '💸 ' : '';
            
            if (displayFormat === 'progressBar') {
                const progressBar = generateProgressBar(percent_used);
                statusBarItem.text = `${icon}${progressBar} ${spendRounded}/${max_budget}$`;
            } else if (displayFormat === 'percentage') {
                statusBarItem.text = `${icon}${percent_used}% (${spendRounded}/${max_budget}$)`;
            } else {
                // Simple format
                statusBarItem.text = `${icon}${spendRounded}/${max_budget}$`;
            }
            
            // Mettre à jour le tableau de bord
            DashboardView.updateDashboard({
                spend: spendRounded,
                maxBudget: max_budget,
                percentUsed: percent_used
            });
            
            // Set color based on percentage
            if (color) {
                statusBarItem.color = new vscode.ThemeColor(`statusBarItem.${color}Foreground`);
            } else {
                statusBarItem.color = undefined;
            }
            
            // Add a rich tooltip that appears on hover
            statusBarItem.tooltip = new vscode.MarkdownString(
                `## ${vscode.l10n.t("Budget Details")}\n` +
                `- **${vscode.l10n.t("Current spend:")}** ${spendRounded}$\n` +
                `- **${vscode.l10n.t("Total budget:")}** ${max_budget}$\n` +
                `- **${vscode.l10n.t("Percentage used:")}** ${percent_used}%\n` +
                `- **${vscode.l10n.t("Progress:")}** ${generateProgressBar(percent_used, 20)}\n\n` +
                `*${vscode.l10n.t("Click for more options")}*`
            );
            statusBarItem.tooltip.isTrusted = true;
            
            // Associate the command to display the context menu
            statusBarItem.command = {
                title: vscode.l10n.t('Show budget menu'),
                command: vscode.l10n.t('litellm.showBudgetMenu'),
                arguments: [spendRounded, max_budget]
            };
        } catch (error) {
            statusBarItem.text = vscode.l10n.t("Budget: Error");
            statusBarItem.tooltip = vscode.l10n.t("Unable to retrieve budget information\nClick to open settings");
            statusBarItem.command = 'litellm.openSettings';
        }
    };

    // Get the initial refresh interval (in seconds)
    const { refreshInterval } = await getConfigValues();
    let interval = setInterval(updateStatusBar, refreshInterval * 1000);

    // Refresh immediately upon activation
    updateStatusBar();

    // Listen for configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async e => {
        if (e.affectsConfiguration('LiteLLM')) {
            // Update the interval if the configuration changes
            const { refreshInterval: newInterval } = await getConfigValues();
            clearInterval(interval);
            interval = setInterval(updateStatusBar, newInterval * 1000);
            
            // Refresh immediately with the new settings
            updateStatusBar();
        }
    }));

    // Clean up resources when the extension is deactivated
    context.subscriptions.push({
        dispose: () => clearInterval(interval),
    });
}

export function deactivate() {
}