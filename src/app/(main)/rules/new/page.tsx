import {getRuleFormData} from "@/actions/rules.actions";
import {RuleForm} from "@/components/rule-form";

export default async function NewRulePage() {
    // Fetch accounts and team members directly on the server
    const {accounts, team} = await getRuleFormData();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Create Alert Rule</h1>
                <p className="text-muted-foreground">Configure a new monitoring parameter for an ad account.</p>
            </div>

            {/* Pass the server-fetched data into the interactive client form */}
            <RuleForm accounts={accounts} team={team}/>
        </div>
    );
}