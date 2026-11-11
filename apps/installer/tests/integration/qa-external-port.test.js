import { execa } from 'execa';
import { describe, it, expect } from 'vitest';

describe('QA external port occupancy (real separate process)',()=>{
  it('blocks a foreign listener while leaving it alive, without a browser', async()=>{
    const {stdout}=await execa('node',['tools/qa/external_port_e2e.mjs'],{
      timeout:20000,
      env:{
        QA_ALLOW_DISPOSABLE_COMPAT_TESTS:'true',
        PLUGIN_TEST_MODE:'true',
        PLUGIN_QA_NO_BROWSER:'true'
      }
    });
    const output=stdout.split('\n').find(line=>line.startsWith('QA_PORT_E2E='));
    expect(output).toBeTruthy();
    const record=JSON.parse(output.slice('QA_PORT_E2E='.length));
    expect(record).toMatchObject({
      scenario:'external_occupied_port_e2e',
      status:'PASS',
      portDetected:true,
      foreignProcessStillServing:true,
      noUnrequestedTermination:true
    });
  });
});
