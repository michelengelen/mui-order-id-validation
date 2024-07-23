const core = require('@actions/core');
const github = require('@actions/github');

const main = async () => {
    try {
        const owner = core.getInput('owner', { required: true });
        const repo = core.getInput('repo', { required: true });
        const issue_number = core.getInput('issue_number', { required: true });
        const token = core.getInput('token', { required: true });

        const orderApiToken = core.getInput('orderApiToken', { required: true });
        const orderApi = 'https://store-wp.mui.com/wp-json/wc/v3/orders/';

        const octokit = new github.getOctokit(token);

        const issue = octokit.rest.issues.get({
            owner,
            repo,
            issue_number,
        });

        // add to this regex the possibility that the ORDER ID is wrapped in ** or __
        const orderIdRegex = /(?:\*|_){0,2}?Order ID(?:\*|_){0,2}?: (\d+)/;
        const orderIdMatch = issue.data.body.match(orderIdRegex)[1];
        const orderId = orderIdMatch ? orderIdMatch[1] : null;

        if (!orderId) {
            core.setFailed('No Order ID found in issue body');
        } else {
            const order = await fetch(`${orderApi}${orderId}`, {
                headers: {
                    Authorization: orderApiToken,
                    'User-Agent': 'MUI-Tools-Private/X-Orders-Inspector v1',
                },
            });
            const orderDetails = await order.json();
            const plan = orderDetails.line_items?.filter(item => item.name.test(/\b(pro|premium)\b/i))[0].name || "";

            if (!plan) {
                core.setFailed('No Pro or Premium plan found in order');
            }

            const planName = plan.match(/\b(pro|premium)\b/i)[0].toLowerCase();
            const labelName =`support: ${planName}`;

            const label = octokit.rest.issues.getLabel({
                owner,
                repo,
                name: labelName,
            });

            octokit.rest.issues.addLabels({
                owner,
                repo,
                issue_number,
                labels: [...issue.data.labels, label],
            });
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();
