import {toNameCase} from "../src/manifest"

describe("manifest", () => {
	describe("toNameCase", () => {
		it("should convert to name case", () => {
			expect(toNameCase("Test"))
				.toBe("Test");
			expect(toNameCase("FirstL"))
				.toBe("FirstL");
			expect(toNameCase("ALLCAPS"))
				.toBe("Allcaps");
		})
	})
})