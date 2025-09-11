export type TuyaStatus = Array<{ code: string; value: any }>;

export function normalizeFromStatus(status: TuyaStatus) {
  let addEleKwh: number|undefined, powerW: number|undefined, voltageV: number|undefined, currentA: number|undefined;
  
  for (const dp of status||[]) {
    if (dp.code==="add_ele")      addEleKwh = Number(dp.value) * 0.01; // set to 1 if already kWh
    if (dp.code==="cur_power")    powerW    = Math.round(Number(dp.value) * 0.1); // set to 1 if already W
    if (dp.code==="cur_voltage")  voltageV  = Number(dp.value) * 0.1;
    if (dp.code==="cur_current")  currentA  = Number(dp.value) * 0.001;
  }
  
  let pfEst: number|undefined;
  if (powerW!=null && voltageV && currentA) {
    const denom = voltageV*currentA;
    if (denom>0) pfEst = Math.max(0, Math.min(1, powerW/denom));
  }
  
  return { addEleKwh, powerW, voltageV, currentA, pfEst };
}