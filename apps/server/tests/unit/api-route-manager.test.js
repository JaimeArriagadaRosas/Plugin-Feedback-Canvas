import { describe, it, expect, vi } from 'vitest';
import ApiRouteManager from '../../src/routes/ApiRouteManager.js';

describe('ApiRouteManager', () => {
  it('instantiates correctly and wires up canvasTokenManager without throwing', () => {
    // Mock the dependencies required by ApiRouteManager
    const mockDependencies = {
      canvasService: {},
      configRepo: {},
      templateManager: { templateRepo: {} },
      courseService: {},
      feedbackService: {},
      iaConfigManager: {},
      llmConfigService: {},
      variableConfigManager: {},
      feedbackWorkflowService: {},
      statsService: { feedbackRepo: {} },
      permissionsService: {},
      privateNoteService: {},
      webhookController: { handleWebhook: vi.fn() },
      canvasTokenRepo: { saveToken: vi.fn() },
      canvasClient: {},
      systemNotificationService: { getRouter: () => ({ use: vi.fn(), get: vi.fn() }) },
      canvasTokenManager: { getToken: vi.fn() } // The critical dependency that caused the crash
    };

    // Instantiate ApiRouteManager
    // This will call initializeControllers, configurePublicRoutes, configureProtectedRoutes
    // If canvasTokenManager is missing or referenced via 'this.deps' instead of 'this.dependencies',
    // it will throw a TypeError: Cannot read properties of undefined.
    let routeManager;
    expect(() => {
      routeManager = new ApiRouteManager(mockDependencies);
    }).not.toThrow();

    // Verify we get a valid router object back
    expect(routeManager.getRouter()).toBeDefined();
    
    // Verify the internal dependencies object correctly holds our canvasTokenManager
    expect(routeManager.dependencies.canvasTokenManager).toBeDefined();
  });
});
