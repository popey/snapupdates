import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src";

async function fetchWorker(request: Request): Promise<Response> {
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

describe("Snap Store Updates worker", () => {
	it("renders the about page through the worker directly", async () => {
		const response = await fetchWorker(new Request("http://example.com/about"));

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
		expect(await response.text()).toContain("About Snap Store Updates");
	});

	it("renders the about page through the integration binding", async () => {
		const response = await SELF.fetch("http://example.com/about");

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("About Snap Store Updates");
	});

	it("rejects an unauthenticated catalogue sync", async () => {
		const response = await fetchWorker(
			new Request("http://example.com/api/sync", { method: "POST" })
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "Unauthorized" });
	});

	it("returns 404 for an unknown route", async () => {
		const response = await SELF.fetch("http://example.com/does-not-exist");

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("Not Found");
	});
});
