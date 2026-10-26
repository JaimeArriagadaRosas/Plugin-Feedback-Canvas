import {describe,it,expect,vi,beforeEach} from 'vitest';
vi.mock('../../src/security/envGuard.js',()=>({isProduction:()=>false}));
vi.mock('../../src/data/db.js',()=>({default:{query:vi.fn(),pool:{connect:vi.fn()}}}));
vi.mock('../../src/data/UsuarioRepository.js',()=>({default:class UsuarioRepository {}}));
import LocalAuthController from '../../src/controllers/AuthController.local.js';
const controller=new LocalAuthController();
const response=()=>({clearCookie:vi.fn(),json:vi.fn().mockReturnValue({ok:true})});
const request={secure:false,get:()=>''};
describe('logout and token-rotation separation',()=>{
  let res,next;
  beforeEach(()=>{res=response();next=vi.fn()});
  it('local logout clears session cookies but does not claim OAuth revocation',async()=>{
    await controller.localLogout(request,res,next);
    expect(next).not.toHaveBeenCalled();
    expect(res.clearCookie.mock.calls.map(c=>c[0])).toEqual(['dev-token','dev-role']);
    expect(res.json).toHaveBeenCalledWith({exito:true});
  });
  it('LTI logout clears only local LTI session cookies',async()=>{
    await controller.ltiLogout(request,res,next);
    expect(next).not.toHaveBeenCalled();
    expect(res.clearCookie.mock.calls.map(c=>c[0])).toEqual(['lti_token','session-token']);
    expect(res.json).toHaveBeenCalledWith({exito:true});
  });
});
