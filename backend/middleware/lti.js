// middleware/lti.js - LTI 1.3 authentication middleware
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { ltiConfig } = require('../config/lti');

// Verify LTI 1.3 JWT token from Canvas
const verifyLTI token = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'No token provided', 
        code: 'MISSING_TOKEN' 
      });
    }
    
    const token = authHeader.substring(7);
    
    // Verify JWT using platform public key
    // In production, fetch JWKS from Canvas and validate properly
    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded) {
      return res.status(401).json({ 
        error: 'Invalid token', 
        code: 'INVALID_TOKEN' 
      });
    }
    
    // Verify issuer
    if (decoded.payload.iss !== ltiConfig.issuer) {
      return res.status(401).json({ 
        error: 'Invalid issuer', 
        code: 'INVALID_ISS' 
      });
    }
    
    // Verify nonce hasn't been used (in production, cache nonces)
    // Simplified for prototype
    
    // Verify audience (client_id)
    if (decoded.payload.aud !== ltiConfig.clientId) {
      return res.status(401).json({ 
        error: 'Invalid audience', 
        code: 'INVALID_AUD' 
      });
    }
    
    // Verify expiration
    const now = Math.floor(Date.now() / 1000);
    if (decoded.payload.exp && decoded.payload.exp < now) {
      return res.status(401).json({ 
        error: 'Token expired', 
        code: 'TOKEN_EXPIRED' 
      });
    }
    
    // Extract Canvas user info from LTI claims
    const ltiClaims = decoded.payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id'];
    
    const user = {
      canvasUserId: decoded.payload.sub,
      name: decoded.payload.name || decoded.payload['https://purl.imsglobal.org/spec/lti/claim/name'] || 'Unknown',
      email: decoded.payload.email || '',
      roles: decoded.payload.roles || [],
      context: {
        canvasCourseId: decoded.payload['https://purl.imsglobal.org/spec/lti/claim/context']?.id,
        canvasAssignmentId: decoded.payload['https://purl.imsglobal.org/spec/lti/claim/resource_link']?.id,
        canvasInstance: decoded.payload.iss
      }
    };
    
    // Determine role
    user.role = mapLtiRolesToPluginRoles(user.roles);
    
    req.user = user;
    req.ltiClaims = ltiClaims;
    req.token = decoded;
    
    next();
  } catch (error) {
    console.error('LTI verification error:', error);
    return res.status(401).json({ 
      error: 'Authentication failed', 
      code: 'AUTH_ERROR' 
    });
  }
};

// Map LTI roles to plugin roles
function mapLtiRolesToPluginRoles(ltiRoles) {
  const roles = ltiRoles.map(r => r.toLowerCase());
  
  if (roles.includes('administrator') || roles.includes('admin')) {
    return 'admin';
  }
  if (roles.includes('instructor') || roles.includes('teacher') || roles.includes('faculty')) {
    return 'teacher';
  }
  if (roles.includes('learner') || roles.includes('student')) {
    return 'student';
  }
  
  return 'student'; // default
}

// Generate JWT for internal service-to-service communication
const generateServiceToken = (payload, expiresIn = '1h') => {
  return jwt.sign(
    {
      ...payload,
      iss: 'feedback-plugin',
      aud: 'feedback-plugin-service'
    },
    process.env.JWT_SECRET || 'dev-secret-change-in-production',
    { expiresIn }
  );
};

// Verify internal service token
const verifyServiceToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-in-production');
    req.serviceUser = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid service token' });
  }
};

// Role-based access control middleware
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions', 
        requiredRoles: allowedRoles,
        userRole: req.user.role 
      });
    }
    
    next();
  };
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ error: 'Admin access required' });
};

// Check if user is teacher or admin
const isTeacherOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'teacher' || req.user.role === 'admin')) {
    return next();
  }
  res.status(403).json({ error: 'Teacher or admin access required' });
};

module.exports = {
  verifyLTIToken,
  generateServiceToken,
  verifyServiceToken,
  authorizeRoles,
  isAdmin,
  isTeacherOrAdmin,
  mapLtiRolesToPluginRoles
};
