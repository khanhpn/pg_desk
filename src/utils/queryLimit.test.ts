import { describe, expect, it } from "vitest";
import { applySelectLimit } from "@/utils/queryLimit";

describe("applySelectLimit", () => {
  it("wraps select SQL with the selected limit", () => {
    expect(applySelectLimit("select id from users;", 500)).toBe(`select *
from (
select id from users
) as pgdesk_limited_query
limit 500;`);
  });

  it("does not modify non-select SQL", () => {
    expect(applySelectLimit("update users set active = true;", 100)).toBe(
      "update users set active = true;",
    );
  });
});
