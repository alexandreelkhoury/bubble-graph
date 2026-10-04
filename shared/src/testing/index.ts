// Test-support entry point (`@mishana/shared/testing`): scripted and bot engine drivers, the secret-leak
// checker and a deterministic catalog. Used by tests, tools/sim and the fixture generator; never by clients.
export * from "./game";
export * from "./bots";
export * from "./leak-check";
export * from "./test-catalog";
