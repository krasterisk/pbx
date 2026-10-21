import axios from "axios";
import { groundCallCandidates } from "./call-semantic-grounding-client";
const provider = {
  uid: 59,
  is_global: true,
  enabled: true,
  endpoint: "https://api.deepseek.com/",
  auth_type: "bearer",
  capabilities: ["llm"],
  defaults: { model: "deepseek-flash" },
};
const calls = [
  {
    callId: "c1",
    segments: [
      {
        id: "s1",
        text: "Вакцины сейчас нет в наличии.",
        startMs: 100,
        endMs: 500,
        speaker: "unknown" as const,
      },
    ],
  },
];
describe("CDR global LLM transport", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses the existing auth, chat URL and DeepSeek structured-response conventions", async () => {
    const post = jest
      .spyOn(axios, "post")
      .mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  results: [
                    {
                      callId: "c1",
                      status: "supported",
                      evidence: [
                        { segmentId: "s1", quote: "сейчас нет в наличии" },
                      ],
                    },
                  ],
                }),
              },
            },
          ],
        },
      });
    await expect(
      groundCallCandidates("вакцины нет", calls, provider, "test-only-key"),
    ).resolves.toHaveLength(1);
    expect(post).toHaveBeenCalledWith(
      "https://api.deepseek.com/v1/chat/completions",
      expect.objectContaining({
        model: "deepseek-flash",
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
      }),
      expect.objectContaining({
        timeout: 45000,
        maxRedirects: 0,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-only-key",
        },
      }),
    );
  });
  it("does not replace failed factual verification with an unverified vector result or expose a provider error body", async () => {
    jest
      .spyOn(axios, "post")
      .mockRejectedValue(new Error("private provider body and credential"));
    await expect(
      groundCallCandidates("вакцины нет", calls, provider, "test-only-key"),
    ).rejects.toThrow(/^CDR_GROUNDING_PROVIDER_UNAVAILABLE$/);
  });
  it("rejects reasoning-only/invalid citations rather than treating them as factual output", async () => {
    jest
      .spyOn(axios, "post")
      .mockResolvedValue({
        data: {
          choices: [{ message: { reasoning_content: '{"results":[]}' } }],
        },
      });
    await expect(
      groundCallCandidates("вакцины нет", calls, provider, ""),
    ).rejects.toThrow("CDR_GROUNDING_RESPONSE_INVALID");
  });
  it("rejects non-global, disabled and insecure providers before network I/O", async () => {
    const post = jest.spyOn(axios, "post");
    for (const patch of [
      { is_global: false },
      { enabled: false },
      { endpoint: "http://api.deepseek.com/" },
    ])
      await expect(
        groundCallCandidates(
          "вакцины нет",
          calls,
          { ...provider, ...patch },
          "",
        ),
      ).rejects.toThrow("CDR_GROUNDING_PROVIDER_UNAVAILABLE");
    expect(post).not.toHaveBeenCalled();
  });
});
