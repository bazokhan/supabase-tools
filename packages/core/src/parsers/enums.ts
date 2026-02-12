export function parseEnumValues(sql: string): string[] {
    const values: string[] = [];
    const regex = /'([^']*)'/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(sql))) {
        values.push(match[1]);
    }
    return values;
}
