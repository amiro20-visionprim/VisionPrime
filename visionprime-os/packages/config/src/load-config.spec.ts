import { loadConfig, EnvironmentValidationError } from "./load-config";

describe("loadConfig", () => {
  const validEnv = {
    NODE_ENV: "test",
    PORT: "4000",
    API_BASE_URL: "http://localhost:4000",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/visionprime",
    REDIS_URL: "redis://localhost:6379",
    LOG_LEVEL: "info",
  };

  it("returns a typed config when all required variables are present", () => {
    const config = loadConfig(validEnv);
    expect(config.PORT).toBe(4000);
    expect(config.API_BASE_URL).toBe("http://localhost:4000");
  });

  it("throws EnvironmentValidationError when DATABASE_URL is missing", () => {
    const { DATABASE_URL, ...rest } = validEnv;
    expect(() => loadConfig(rest)).toThrow(EnvironmentValidationError);
  });

  it("reports the specific missing/invalid keys in details", () => {
    const { REDIS_URL, ...rest } = validEnv;
    try {
      loadConfig(rest);
      fail("expected loadConfig to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(EnvironmentValidationError);
      expect((err as EnvironmentValidationError).details).toHaveProperty("REDIS_URL");
    }
  });

  it("applies defaults for optional variables", () => {
    const config = loadConfig(validEnv);
    expect(config.NODE_ENV).toBe("test");
  });
});
