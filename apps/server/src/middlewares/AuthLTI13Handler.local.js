import { verifyDevToken } from '../security/crypto.js';

export const AuthLTI13Handler_local = (req, res, next) => {
  if (process.env.ENABLE_TEST_AUTH_BYPASS === 'true' && req.cookies) {
    const testToken = req.cookies['lti-token'];
    if (testToken && testToken.startsWith('dev-token') && verifyDevToken(testToken)) {
      const role = testToken.split(':')[1] || 'admin';
      const roleURN = role === 'admin'
        ? 'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator'
        : role === 'student'
          ? 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'
          : 'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor';
      const localId = role === 'admin' ? '00000000-0000-0000-0000-000000000001' :
                      role === 'student' ? '00000000-0000-0000-0000-000000000002' :
                      '00000000-0000-0000-0000-000000000003'; // teacher
      req.ltiContext = { user: localId, role: [roleURN], courseId: 14852, localRole: role, source: 'test' };
      req.user = { id: localId };
      return next();
    }
  }
  next();
};
