export function parseTriggerDetails(sql: string): {
    timing: string;
    events: string;
    function_name: string;
} {
    const triggerLine = sql
        .split(/\r?\n/)
        .find((line) => line.trim().toUpperCase().startsWith("CREATE TRIGGER"));
    if (!triggerLine) return { timing: "", events: "", function_name: "" };
    const timingMatch = triggerLine.match(/\b(BEFORE|AFTER|INSTEAD OF)\b/i);
    const eventsMatch = triggerLine.match(/\b(BEFORE|AFTER|INSTEAD OF)\b\s+(.+?)\s+ON\b/i);
    const functionMatch = triggerLine.match(/EXECUTE FUNCTION\s+([^\s(]+)\s*\(/i);
    return {
        timing: timingMatch ? timingMatch[1].toUpperCase() : "",
        events: eventsMatch ? eventsMatch[2].toUpperCase() : "",
        function_name: functionMatch ? functionMatch[1] : "",
    };
}
