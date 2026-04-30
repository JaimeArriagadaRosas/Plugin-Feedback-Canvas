// config/lti.js - LTI 1.3 configuration
require('dotenv').config();

module.exports = {
  // LTI 1.3 Core Settings
  clientId: process.env.LTI_CLIENT_ID || 'feedback-plugin-client',
  deploymentId: process.env.LTI_DEPLOYMENT_ID || 'feedback-plugin-deployment',
  
  // Keys (in production, use proper key management)
  privateKey: process.env.LTI_PRIVATE_KEY || `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAx8XepEDqGox4q8xLkYKg1pQYrUhEe1S5GZaC8pNQnFQ0ArOdT
placeholder_key_replace_in_production_do_not_use_in_production
-----END RSA PRIVATE KEY-----`,
  publicKey: process.env.LTI_PUBLIC_KEY || `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAx8XepEDqGox4q8xLkYKg1
placeholder_key_replace_in_production_do_not_use_in_production
-----END PUBLIC KEY-----`,
  
  // OAuth / OIDC endpoints (Canvas instance URL)
  issuer: process.env.CANVAS_URL || 'http://localhost:3000',
  authLogin: process.env.CANVAS_URL ? `${process.env.CANVAS_URL}/login/oauth2/auth` : 'http://localhost:3000/login/oauth2/auth',
  authToken: process.env.CANVAS_URL ? `${process.env.CANVAS_URL}/login/oauth2/token` : 'http://localhost:3000/login/oauth2/token',
  keys: process.env.CANVAS_URL ? `${process.env.CANVAS_URL}/api/lti/security/jwks` : 'http://localhost:3000/api/lti/security/jwks',
  
  // Platform / Tool URLs
  toolUrl: process.env.TOOL_URL || 'http://localhost:3001',
  launchUrl: process.env.TOOL_URL ? `${process.env.TOOL_URL}/lti/launch` : 'http://localhost:3001/lti/launch',
  
  // Deep linking (optional)
  deepLinkingEnabled: true,
  
  // Security
  tokenExpiration: 3600, // 1 hour
  nonceExpiration: 300, // 5 minutes
  
  // Canvas API access (via LTI launch claims)
  canvasApiUrl: process.env.CANVAS_URL || 'http://localhost:3000',
};
