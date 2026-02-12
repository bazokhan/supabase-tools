/**
 * HTML section stubs for the Edge Functions section in Backend Atlas.
 */
export function edgeFunctionSectionHtml(): string {
  return `    <section class="section" id="section-edge-functions">
      <h2>Edge Functions</h2>
      <p class="section-sub">Serverless Deno functions invoked via HTTP. Includes endpoint, auth, request/response schemas, and usage recipes.</p>
      <div class="cards" id="edge-functions-list"></div>
    </section>

`;
}
