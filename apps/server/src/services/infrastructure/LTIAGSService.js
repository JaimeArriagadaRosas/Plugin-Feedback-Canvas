import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import logger from '../../utils/logger.js';
import CanvasClient from './CanvasClient.js';


/**
 * Integration Service with LTI AGS (Assignment and Grade Services)
 * Allows sending grades and feedback to SpeedGrader without individual API Keys.
 */
export default class LTIAGSService {
  constructor(clientId, authUrl, privateKey = null, useLocalMode = false, canvasClient = null) {
    this.clientId = clientId;
    this.authUrl = authUrl || 'https://canvas.instructure.com/login/oauth2/token';
    this.privateKey = privateKey;
    this.useLocalMode = useLocalMode;
    this.canvasClient = canvasClient || new CanvasClient();
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  /**
   * Gets an LTI Advantage access token (oauth2/token) using Client Credentials and JWT
   */
  async getAccessToken() {
    // If we already have a valid token, reuse it
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (this.useLocalMode || !this.privateKey) {
      logger.debug('[LTI-AGS] Using local Access Token (Local Mode)');
      this.accessToken = 'local-ags-token-12345';
      this.tokenExpiry = Date.now() + 3600 * 1000;
      return this.accessToken;
    }

    try {
      // Generate the Client Assertion JWT signed with the RS256 private key
      const payload = {
        iss: this.clientId,
        sub: this.clientId,
        aud: this.authUrl,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes expiration
        jti: randomBytes(16).toString('hex')
      };

      const signedAssertion = jwt.sign(payload, this.privateKey, {
        algorithm: 'RS256',
        keyid: process.env.LTI_KEY_ID || 'lti-key-1'
      });
        const response = await this.canvasClient.rawFetch(this.authUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            client_assertion: signedAssertion,
            scope: 'https://purl.imsglobal.org/spec/lti-ags/scope/score'
          }),
          returnFullResponse: true,
          timeoutMs: 15000
        });

        if (!response.ok) {
          throw new Error(`Error in LTI token [${response.status}]: ${response.statusText}`);
        }

        const data = await response.json();
        this.accessToken = data.access_token;
        this.tokenExpiry = Date.now() + (data.expires_in - 30) * 1000;
        return this.accessToken;
      } catch (error) {
      logger.error('[LTI-AGS] Error getting access token:', { error: error.message });
      throw new Error('Could not authenticate with Canvas LTI AGS');
    }
  }

  /**
   * Sends grade and feedback to SpeedGrader using AGS
   * @param {string} scoresUrl Scores endpoint (usually in the AGS claim of the token launch)
   * @param {string} studentId ID of the student to evaluate
   * @param {number|string} score Assigned grade
   * @param {number|string} maxScore Maximum possible grade
   * @param {string} comment Feedback comment
   */
  async submitScoreAndComment(scoresUrl, studentId, score, maxScore, comment) {
    if (this.useLocalMode) {
      logger.debug(`[LTI-AGS] [LOCAL] Sending grade to Canvas SpeedGrader:\n        URL: ${scoresUrl}\n        Student: ${studentId}\n        Grade: ${score}/${maxScore}\n        Comment: ${comment.substring(0, 60)}...`);
      return { success: true, message: 'Test grade sent successfully (Local)' };
    }

    try {
      const token = await this.getAccessToken();
      
      const payload = {
        userId: studentId,
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded',
        scoreGiven: parseFloat(score),
        scoreMaximum: parseFloat(maxScore),
        comment: comment
      };
        const response = await this.canvasClient.rawFetch(scoresUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/vnd.ims.lis.v1.score+json'
          },
          body: JSON.stringify(payload),
          returnFullResponse: true,
          timeoutMs: 15000
        });

        if (!response.ok) {
          throw new Error(`Error sending grade [${response.status}]: ${response.statusText}`);
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return await response.json();
        }
        return {};
      } catch (error) {
      logger.error('[LTI-AGS] Error publishing score to Canvas:', { error: error.message });
      throw error;
    }
  }
}
