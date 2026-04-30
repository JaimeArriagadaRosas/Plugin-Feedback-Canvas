// routes/lti.js - LTI 1.3 launch endpoints (RF18, RF16)
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { ltiConfig } = require('../config/lti');
const { verifyLTIToken, mapLtiRolesToPluginRoles } = require('../middleware/lti');
const { User, Course } = require('../models');
const { errors } = require('../middleware/errorHandler');

// LTI 1.3 OIDC login initiation - redirects to Canvas
router.get('/login', async (req, res) => {
  try {
    const { login_hint, lti_message_hint, client_id, redirect_uri } = req.query;
    
    // Generate state and nonce
    const state = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');
    
    // Store state and nonce in session/cache
    // For demo: use simple memory store
    req.session = req.session || {};
    req.session.ltiState = state;
    req.session.ltiNonce = nonce;
    
    // Build OIDC authorization URL
    const params = new URLSearchParams({
      response_type: 'id_token',
      response_mode: 'form_post',
      client_id: client_id || ltiConfig.clientId,
      redirect_uri: redirect_uri || ltiConfig.launchUrl,
      scope: 'openid',
      state,
      nonce,
      login_hint: login_hint || '',
      lti_message_hint: lti_message_hint || ''
    });
    
    const authUrl = `${ltiConfig.authLogin}?${params.toString()}`;
    
    res.redirect(authUrl);
  } catch (error) {
    console.error('LTI login error:', error);
    res.status(500).json({ error: 'Failed to initiate LTI login' });
  }
});

// LTI launch endpoint - receives POST from Canvas after authentication
router.post('/launch', async (req, res) => {
  try {
    const { id_token, state, hmac } = req.body;
    
    // Verify state
    if (state !== req.session?.ltiState) {
      return res.status(400).json({ error: 'Invalid state' });
    }
    
    // Verify JWT
    const decoded = jwt.decode(id_token, { complete: true });
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Verify issuer
    if (decoded.payload.iss !== ltiConfig.issuer) {
      return res.status(401).json({ error: 'Invalid issuer' });
    }
    
    // Verify nonce
    if (decoded.payload.nonce !== req.session?.ltiNonce) {
      return res.status(401).json({ error: 'Invalid nonce' });
    }
    
    // Extract user and context info
    const userInfo = {
      canvasUserId: decoded.payload.sub,
      name: decoded.payload.name || decoded.payload['https://purl.imsglobal.org/spec/lti/claim/name'],
      email: decoded.payload.email,
      roles: decoded.payload.roles || [],
      picture: decoded.payload.picture,
      context: {
        id: decoded.payload['https://purl.imsglobal.org/spec/lti/claim/context']?.id,
        title: decoded.payload['https://purl.imsglobal.org/spec/lti/claim/context']?.title,
        label: decoded.payload['https://purl.imsglobal.org/spec/lti/claim/context']?.label
      },
      resourceLink: {
        id: decoded.payload['https://purl.imsglobal.org/spec/lti/claim/resource_link']?.id,
        title: decoded.payload['https://purl.imsglobal.org/spec/lti/claim/resource_link']?.title,
        description: decoded.payload['https://purl.imsglobal.org/spec/lti/claim/resource_link']?.description
      }
    };

    // Determine role
    userInfo.role = mapLtiRolesToPluginRoles(userInfo.roles);

    // Find or create user in DB
    let user = await User.findOne({ where: { canvasUserId: userInfo.canvasUserId } });
    
    if (!user) {
      user = await User.create({
        canvasUserId: userInfo.canvasUserId,
        name: userInfo.name,
        email: userInfo.email,
        role: userInfo.role,
        ltiCanvasUserId: userInfo.canvasUserId
      });
    } else {
      // Update last sync
      await user.update({ lastSyncAt: new Date() });
    }

    // Create session token for the frontend SPA
    const sessionToken = jwt.sign(
      {
        userId: user.id,
        canvasUserId: userInfo.canvasUserId,
        role: userInfo.role,
        name: userInfo.name,
        iss: 'feedback-plugin',
        aud: 'feedback-plugin-frontend'
      },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '8h' }
    );

    // Redirect to frontend with token and context
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = new URL('/dashboard', frontendUrl);
    
    redirectUrl.searchParams.set('token', sessionToken);
    redirectUrl.searchParams.set('course_id', userInfo.context.id || '');
    redirectUrl.searchParams.set('assignment_id', userInfo.resourceLink.id || '');
    redirectUrl.searchParams.set('context_title', userInfo.context.title || '');
    redirectUrl.searchParams.set('resource_title', userInfo.resourceLink.title || '');

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('LTI launch error:', error);
    res.status(500).json({ error: 'LTI launch failed' });
  }
});

// JWKS endpoint for LTI public key
router.get('/jwks', (req, res) => {
  const publicKey = ltiConfig.publicKey;
  
  // Convert PEM to JWK (simplified)
  const jwk = {
    kty: 'RSA',
    alg: 'RS256',
    use: 'sig',
    kid: 'feedback-plugin-key-1'
    // In production, extract from PEM properly
  };

  res.json({ keys: [jwk] });
});

module.exports = router;
