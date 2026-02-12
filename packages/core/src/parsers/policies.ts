export function parsePolicyBlocks(content: string): Array<{ name: string; sql: string }> {
    const blocks: Array<{ name: string; sql: string }> = [];
    const regex = /-- Policy:\s*(.+)\n([\s\S]*?)(?=-- Policy:|$)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content))) {
        const name = match[1].trim();
        const sql = match[2].trim();
        blocks.push({ name, sql });
    }
    return blocks;
}

export function parsePolicyDetail(blockSql: string): {
    permissive: string;
    command: string;
    roles: string;
    using: string;
    with_check: string;
} {
    const permissiveMatch = blockSql.match(/\bAS\s+(PERMISSIVE|RESTRICTIVE)\b/i);
    const commandMatch = blockSql.match(/\bFOR\s+([A-Z]+)\b/i);
    const rolesMatch = blockSql.match(/\bTO\s+([^\n]+)/i);
    const usingMatch = blockSql.match(/\bUSING\s+\(([^\n]+)\)/i);
    const withCheckMatch = blockSql.match(/\bWITH CHECK\s+\(([^\n]+)\)/i);
    return {
        permissive: permissiveMatch ? permissiveMatch[1].toUpperCase() : "",
        command: commandMatch ? commandMatch[1].toUpperCase() : "",
        roles: rolesMatch ? rolesMatch[1].trim() : "",
        using: usingMatch ? usingMatch[1].trim() : "",
        with_check: withCheckMatch ? withCheckMatch[1].trim() : "",
    };
}
