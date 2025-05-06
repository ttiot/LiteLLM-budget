import fetch from 'node-fetch';
import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext) {
    // Command to open extension settings
    const openSettingsCommand = 'litellm.openSettings';
    context.subscriptions.push(vscode.commands.registerCommand(openSettingsCommand, () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'LiteLLM');
    }));

    // Command to refresh budget information
    const refreshBudgetCommand = 'litellm.refreshBudget';
    context.subscriptions.push(vscode.commands.registerCommand(refreshBudgetCommand, () => {
        updateStatusBar();
        vscode.window.showInformationMessage(vscode.l10n.t('Budget information refreshed'));
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

    // Function to update the status bar
    const updateStatusBar = async () => {
        const { apiKey, apiUrl } = await getConfigValues(); // Retrieve API key and URL

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

            // Update the status bar text
            statusBarItem.text = `💸 ${spendRounded}/${max_budget}$`;
            
            // Add a rich tooltip that appears on hover
            let percent_used = max_budget > 0 ? Math.round((spendRounded / max_budget) * 100) : 0;
            statusBarItem.tooltip = new vscode.MarkdownString(
                `## ${vscode.l10n.t("Budget Details")}\n` +
                `- **${vscode.l10n.t("Current spend:")}** ${spendRounded}$\n` +
                `- **${vscode.l10n.t("Total budget:")}** ${max_budget}$\n` +
                `- **${vscode.l10n.t("Percentage used:")}** ${percent_used}%\n\n` +
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