/*
respiration_math.js : COVID-19 Respiration Analysis Software
Copyright (C) 2020  Robert L. Read

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/


const CONVERT_PIRDS_TO_SLM = 1/1000;

function unpack(rows, key) {
    return rows.map(function(row) { return row[key]; });
}


function compute_transitions(vm,flows) {
  var transitions = [];
  var state = 0; // Let 1 mean inspiration, -1 mean expiration, 0 neither
  for(var i = 0; i < flows.length; i++) {
    var f = flows[i].val * CONVERT_PIRDS_TO_SLM;
    //    var ms = flows[i].ms-first_time;
    var ms = flows[i].ms;
    if (state == 0) {
      if (f > vm) {
	state = 1;
	transitions.push({ state: 1, sample: i, ms: ms})
      } else if (f < -vm) {
	state = -1;
	transitions.push({ state: -1, sample: i, ms: ms})
      }
    } else if (state == 1) {
      if (f < -vm) {
	state = -1;
	transitions.push({ state: -1, sample: i, ms: ms})
      } else if (f < vm) {
	state = 0;
	transitions.push({ state: 0, sample: i, ms: ms})
      }
    } else if (state == -1) {
      if (f > vm) {
	state = 1;
	transitions.push({ state: 1, sample: i, ms: ms})
      } else if (f > 0) {
	state = 0;
	transitions.push({ state: 0, sample: i, ms: ms})
      }
    }
  }
  return transitions;
}

// Return, [min,avg,max] pressures (no smoothing)!
function compute_pressures(secs,samples,alarms,limits) {
  var pressures = samples.filter(s => s.event == 'M' && s.type == 'D' && (s.loc == 'I' || s.loc == 'A'));

  if (pressures.length == 0) {
    return [0,0,0,[]];
  } else {
    const recent_ms = pressures[pressures.length - 1].ms;
    var cur_ms = recent_ms;
    var cnt = 0.0;
    var i = pressures.length - 1;
    var cur_sample = pressures[i];

    var min = Number.MAX_VALUE;
    var max = Number.MIN_VALUE;
    var sum = 0;
    var alarms = [];
    while((i >=0) && (pressures[i].ms > (cur_ms - secs*1000))) {
      var p = pressures[i].val / 10.0;  // this is now cm H2O
      if (p < min ) {
        min = p;
      }
      if (p > max) {
        max = p;
      }
      sum += p;
      cnt++;
      alarms = alarms.concat(check_alarms(limits,"max","h",p,(a,b) =>(a > b),pressures[i].ms));
      alarms = alarms.concat(check_alarms(limits,"max","l",p,(a,b) =>(a < b),pressures[i].ms));
      i--;
    }
    return [min,sum/cnt,max,alarms];
  }
}


function compute_fio2_mean(secs,samples) {
  var oxygens = samples.filter(s => s.event == 'M' && s.type == 'O' && (s.loc == 'I' || s.loc == 'A'));

  if (oxygens.length == 0) {
    return null;
  } else {
    const recent_ms = oxygens[oxygens.length - 1].ms;
    var cur_ms = recent_ms;
    var cnt = 0.0;
    var i = oxygens.length - 1;

    var sum = 0;
    var alarms = [];
    while((i >=0) && (oxygens[i].ms > (cur_ms - secs*1000))) {
      var oxy = oxygens[i].val; // oxygen concentration as a percentage
      sum += oxy;
      cnt++;
      i--;
    }

    var fio2_avg = sum / cnt;

    return fio2_avg;
  }
}

// WARNING! With a low number of breaths, this may be wrong.
function compute_respiration_rate(secs,samples,transitions,breaths) {
  // In order to compute the number of breaths
  // in the last s seconds, I compute those breaths
  // whose time stamp is s seconds from the most recent sample

  // We will compute respiration rate by counting breaths
  // and dividing (cnt - 1) by time the first and last inhalation
  var first_inhale_ms = -1;
  var last_inhale_ms = -1;
  if (breaths.length == 0) {
    return [0,0,0,"NA","NA"];
  } else {
    const recent_ms = samples[samples.length - 1].ms;
    var cur_ms = recent_ms;
    var cnt = 0.0;
    var vol_i = 0.0;
    var vol_e = 0.0;
    var i = breaths.length - 1;
    var time_inh = 0;
    var time_exh = 0;
    // fully completed inhalation volume does not include the
    // most recent breath; we need it to be able to accurately
    // divide by the inhlation_duration.
    var vol_ci = 0.0;

    var wob = 0.0;
    var wob_cnt = 0;

    while((i >=0) && (breaths[i].ms > (cur_ms - secs*1000))) {
      cnt++;
      vol_i += breaths[i].vol_i;
      if (i < (breaths.length -1)) {
        vol_ci += breaths[i].vol_i;
      }
      vol_e += breaths[i].vol_e;

      const inh_ms = transitions[breaths[i].trans_begin_inhale].ms;
      // note i is counting down in this loop...
      if (last_inhale_ms < 0) last_inhale_ms = inh_ms;
      first_inhale_ms = inh_ms;
      const exh_ms = transitions[breaths[i].trans_end_exhale].ms;
      const zero_ms = transitions[breaths[i].trans_cross_zero].ms;
      time_inh += (zero_ms - inh_ms);
      time_exh += (exh_ms -  zero_ms);

      if (breaths[i].work != null)  {
        wob += breaths[i].work / breaths[i].vol_i;
        wob_cnt++;
      }
      i--;
    }
    if ((cnt > 1) && (first_inhale_ms != last_inhale_ms)) {
      // I now think this math is specious!!
      var inhalation_duration = last_inhale_ms - first_inhale_ms;
      var inhalation_duration_min = inhalation_duration / (60.0 * 1000.0);
      var rr = (cnt - 1) / inhalation_duration_min;
      var duration_minutes = secs / 60.0;

      // This is liters per minute. vol_ci is in liters.
      // inhalation_duration is in ms.
      var minute_volume =  vol_ci / inhalation_duration_min;

      var tidal_volume = 1000.0 * vol_i / cnt;

      var EIratio = (time_inh == 0) ? null : time_exh / time_inh;
      var WorkOfBreathing_J_per_L = wob / wob_cnt;
      return  [
        rr,
        tidal_volume,
        minute_volume,
        EIratio,
        WorkOfBreathing_J_per_L];
    } else {
      return [0,0,0,"NA","NA"];
    }
  }
}


// produces a set of rising signals, time in ms of the leading edge of the rise and the trailing edge of the rise
// an array of 2-tuple
// taip == true implies compute TAIP, else compute TRIP
// Possibly this routine should be generalized to a general rise-time routine.
function compute_TAIP_or_TRIP_signals(min,max,pressures,taip) {
  var pressures = pressures.filter(s => s.event == 'M' && s.type == 'D' && (s.loc == 'I' || s.loc == 'A'));
  const responseBegin = 0.1;
  const responseEnd = 0.9;

  var signals = [];
  var foundMinSignal = false;

  const highFence = (min + (responseEnd * (max - min)))*10;
  const lowFence = (min + (responseBegin * (max - min)))*10;

  var cur_signal_start;
  var state = -1; // Let 1 mean rising, -1 mean fallen, 0 risen, but not fallen
  var first_sample_index = taip ? 0 : pressures.length-1 ;
  var last_sample_index = taip ? pressures.length-1 : 0;
  var increment = taip ? 1 : -1;
  for(var i = first_sample_index; i != last_sample_index; i+=increment) {
    var p = pressures[i].val;
    var ms = pressures[i].ms;
    if (state == -1) {
      if (p >= lowFence) {
	      state = 1;
        cur_signal_start = pressures[i];
      }
      if (p >= highFence){
        signals.push([ms,ms]);
      }
    } else if (state == 1) {
      //console.log("state = 1",cur_signal_start); for debugging
      if (p >= highFence) {
        signals.push(taip ? [cur_signal_start.ms,ms] : [ms,cur_signal_start.ms])
        state = 0;
      } else if (p <= lowFence) {
        state = -1;
        cur_signal_start = null;
      }
    } else if (state == 0) {
      if (p <= lowFence) {
	state = -1;
      }
    }
  }
  return signals;
}

function compute_mean_TRIP_or_TAIP_sigs(sigs,min,max,pressures,taip){
  if (sigs.length == 0){
    return "NA";
  } else {
    var sum = 0;
    for(var i = 0; i < sigs.length; i++) {
      sum += sigs[i][1] - sigs[i][0];  // time in ms
    }
    return sum / sigs.length;
  }
}

function testdata(){
  //0 (not good enough), 10 (rising), 20 (above threshold) all 10 ms apart
  //saw tooth function
  var data = []; // pushing 50 things into it
  for(var i = 0; i < 10; i++) {
    var ms = i*5*10;
    data[i*5+0] = {event:'M',loc:'I',ms:ms + 0,type:'D',val: 0};
    data[i*5+1] = {event:'M',loc:'I',ms:ms + 10,type:'D',val: 100};
    data[i*5+2] = {event:'M',loc:'I',ms:ms + 20,type:'D',val: 200};
    data[i*5+3] = {event:'M',loc:'I',ms:ms + 30,type:'D',val: 100};
    data[i*5+4] = {event:'M',loc:'I',ms:ms + 40,type:'D',val: 0};
  }
  return data;
}

function testdataSine(period_sm){ // period expressed in # of samples, each sample 10 ms
  //0 (not good enough), 10 (rising), 20 (above threshold) all 10 ms apart
  //sine tooth function
  var data = []; // pushing 50 things into it
  for(var i = 0; i < 1000; i++) {
    var ms = i*10;
    data[i] = {event:'M',loc:'I',ms:ms + 20,type:'D',val: 200*Math.sin(2*Math.PI*i/period_sm)};
  }
  return data;
}

function compute_mean_TRIP_or_TAIP(min,max,samples,taip) {
  return compute_mean_TRIP_or_TAIP_sigs(
    compute_TAIP_or_TRIP_signals(min,max,samples,taip),
    min,max,samples,taip);
}

function test_compute_TAIP() {
  var samples = testdata();
  const TAIP_min = 0; // cm of H2O
  const TAIP_max = 20; // cm of H2O
  var TAIP_m = compute_mean_TRIP_or_TAIP(min,max,samples,true);
  console.assert(TAIP_m == 10);
  for (i = 50; i<150; i+=10) {
    var sinewave = testdataSine(i);
    var TAIP_m = compute_mean_TRIP_or_TAIP(min,max,sinewave,true);
  }
}

function compute_current_TAIP(TAIP_min,TAIP_max){ //uses samples from a global var
  var TAIP_m = compute_mean_TRIP_or_TAIP(TAIP_min,TAIP_max,samples,true);
  return TAIP_m;
}

// Because TAIP and TRIP are symmetric when viewed from
// from the direction of the samples; this tests that
// as a prelude to computing a single way.

function reverseArray(arr) {
  var newArray = [];
  for (var i = arr.length - 1; i >= 0; i--) {
    newArray.push(arr[i]);
  }
  return newArray;
}
function test_TRIP_and_TAIP_are_symmetric() {
  var samples = testdata();
  var rsamples = reverseArray(samples);
  const min = 0;
  const max = 20;
  var TRIP_m = compute_mean_TRIP_or_TAIP(min,max,samples,false);
  var TRIP_m_r = -compute_mean_TRIP_or_TAIP(min,max,rsamples,true);
  console.assert(TRIP_m == TRIP_m_r);
  console.assert(TRIP_m == 10);
  for (i = 50; i<150; i+=10) {
    var sinewave = testdataSine(i);
    var rsinewave = reverseArray(sinewave);
    var TRIP_m = compute_mean_TRIP_or_TAIP(min,max,samples,false);
    var TRIP_m_r = -compute_mean_TRIP_or_TAIP(min,max,rsamples,true);
    console.assert(TRIP_m == TRIP_m_r);
    var TAIP_m = compute_mean_TRIP_or_TAIP(min,max,samples,true);
    var TAIP_m_r = -compute_mean_TRIP_or_TAIP(min,max,rsamples,false);
    console.assert(TAIP_m == TAIP_m_r);
  }
}

function compute_current_TRIP(TRIP_min,TRIP_max, samples)
{ //uses samples from a global var
  if (samples.length == 0){
    return "NA";
  }
  else {
    var TRIP_m = compute_mean_TAIP_or_TRIP(TRIP_min,TRIP_max,false);
    return TRIP_m;
  }
}




  // A routine to calculate work per breath
function PressureVolumeWork(breath, transitions, samples) {
  // -1 for quadilateral approximation
  if (breath.vol_i == 0) {
    return null;
  } else {
    var beginTransition = transitions[breath.trans_begin_inhale];
    var beginTime_ms = beginTransition.ms;
    var endTransition = transitions[breath.trans_cross_zero];
    var endTime_ms = endTransition.ms;
    var flows = samples.filter(s => s.event == 'M' && s.type == 'F' &&
                               s.ms >= beginTime_ms && s.ms <= endTime_ms);
    var pressures = samples.filter(s => s.event == 'M' && s.type == 'D' &&
                                   (s.loc == 'I' || s.loc == 'A') && s.ms >= beginTime_ms && s.ms <= endTime_ms);

    // Note: The algorithm below relies on the fact that there is
    // only one flow or pressure with a single ms value; and that
    // increvementing an index necessarily incremenst the .ms value.

    // Without two samples, we have no duration and can't define
    // work.
    if (pressures.length < 2 || flows.length < 2) return null;

    var ct = Math.min(flows[0].ms,pressures[0].ms);
    var lfp = { val : flows[0].val, ms: flows[0].ms } ; // last flow point
    var lpp = { val : pressures[0].val, ms: pressures[0].ms }; // last pressure_point
    var fi = increment_past(flows,flows[0].ms,0); // Index of next flow sample
    var pi = increment_past(pressures,pressures[0].ms,0); // Index of next pressure sample
    var w = 0; // current work

    // compute flow at time ms give index and last point
    // This is just a simple linear interpolation
    function f(ms,cur,last) {
      var ms0 = last.ms;
      var ms1 = cur.ms;
      return last.val + (cur.val - last.val)*(ms - ms0)/(ms1 - ms0);
    }
    function increment_past(array,ms,index) {
      var begin = index;
      while(index < array.length && array[index].ms <= ms)
        index++;
      if (index == begin) debugger;
      if (index >= array.length)
        return null;
      else
        return index;
    }

    // A fundamental invariant:
    // pressures[pi].ms > lpp.ms
    // flows[pi].ms > lfp.ms
    while ((fi + pi) < (flows.length +  pressures.length)) {
      // Invariant always increment fi or pi
      // fi and pi point to unprocessed value
      console.assert(pressures[pi].ms > lpp.ms);
      console.assert(flows[fi].ms > lfp.ms);
      var ms;
      if (pressures[pi].ms <= flows[fi].ms) { // process pressure
        ms = pressures[pi].ms;
        pi = increment_past(pressures,ms,pi);
        if (flows[fi].ms <= ms) {
          fi = increment_past(flows,ms,fi);
        }
      } else {
        ms = flows[fi].ms;
        fi = increment_past(flows,ms,fi);
        if (pressures[pi].ms <= ms) {
          pi = increment_past(pressures,ms,pi);
        }
      }
      if ((fi === null) || (pi === null))
        break;
      var dur_s = (ms - ct) / 1000;
      console.assert(pressures[pi].ms > lpp.ms);
      console.assert(flows[fi].ms > lfp.ms);
      var nf = f(ms,flows[fi],lfp);
      var np = f(ms,pressures[pi],lpp);
      var f1 = (lfp.val + nf)/2;
      var p1 = (lpp.val + np)/2;
      // convert 10ths of cm H2O to pascals..
      var p1_pa = (p1 * 98.0665) / 10;

      // convert flows in lpm to cubic meters per seconds
      var f1_m_cubed_per_s = f1 / (1000 * 1000 * 60);

      // work is now in Joules!
      w += dur_s * p1_pa * f1_m_cubed_per_s;
      lfp = { val : f1, ms: ms };
      lpp = { val : p1, ms: ms };
      ct = ms;
    }
    return w;
  }
}

// Let's first set up a perfectly square 1-second
function generate_synthetic_trace() {
  const SAMPLES_PER_PHASE = 1000;
  const SAMPLES_MS_PER_SAMPLE = 1;
  var trace = [];
  var cur = 0;
  // p is a probability of occuring.
  function push_samples(start,num,d,f,pd,pf) {
    for(var i = start; i < start+num; i++) {
      if (Math.random() < pd) {
        trace.push(
          {
            event: "M",
            loc: "A",
            ms: i,
            num: 0,
            type: "D",
            val: d
          });
      }
      if (Math.random() < pf) {
        trace.push(
          {
            event: "M",
            loc: "A",
            ms: i,
            num: 0,
            type: "F",
            val: f
          });
      }
    }
  }
  const P1 = 1/2;
  const P2 = 1/2;
  push_samples(SAMPLES_PER_PHASE,SAMPLES_PER_PHASE,200,50000,P1,P2);
  push_samples(0,SAMPLES_PER_PHASE,-200,-50000,P1,P2);
  push_samples(SAMPLES_PER_PHASE,SAMPLES_PER_PHASE,200,50000,P1,P2);
  push_samples(SAMPLES_PER_PHASE*2,SAMPLES_PER_PHASE,-200,-50000,P1,P2);
  push_samples(SAMPLES_PER_PHASE*3,SAMPLES_PER_PHASE,200,50000,P1,P2);
  return trace;
}

function nearp(x,y,d) {
  return Math.abs(x - y) <= d;
}

function testWorkSynthetic(){ // breaths give us inspiration transition points
  var samples = generate_synthetic_trace();

  const JOULES_IN_BREATH = 1 * 1961.33 * 50000 / (60e+6);

  var flows = samples.filter(s => s.event == 'M' && s.type == 'F');
    var first_time = flows[0].ms;
    var last_time = flows[flows.length - 1].ms;
    var duration = last_time - first_time;
    console.log(flows);


  const vm = 10;
  // There is a problem here that this does not create a transition at the beginning.
  var transitions = compute_transitions(vm,flows);
    var breaths = compute_breaths_based_without_negative_flow(transitions,flows);
    console.log(breaths);
    for(i = 0; i<breaths.length; i++) {
      var w = PressureVolumeWork(breaths[i], transitions, samples);
      console.assert((w == null) || (nearp(w,JOULES_IN_BREATH),0.1));
      console.log("final (Joules) = ",w);
    }
  return true;
}


  function testWork(samples){ // breaths give us inspiration transition points
    var flows = samples.filter(s => s.event == 'M' && s.type == 'F');
    var first_time = flows[0].ms;
    var last_time = flows[flows.length - 1].ms;
    var duration = last_time - first_time;
    console.log(flows);

    const vm = 10;
    var transitions = compute_transitions(vm,flows);
    var breaths = compute_breaths_based_without_negative_flow(transitions,flows);
    console.log(breaths);
    for(i = 0; i<breaths.length; i++) {
      var w = PressureVolumeWork(breaths[i], transitions, samples);
      console.log(w);
    }
   }



  // This should be in liters...
  function integrateSamples(a,z,flows) {
    // -1 for quadilateral approximation
    var vol = 0;
    for(var j = a; j < z-1; j++) {
      // I'll use qadrilateral approximation.
      // We'll form each quadrilateral between two samples.
      var ms = flows[j+1].ms - flows[j].ms;
      var ht = ((flows[j+1].val + flows[j].val )/2) * CONVERT_PIRDS_TO_SLM;
      // Flow is actually in standard liters per minute,
      // so to get liters we divide by 60 to it l/s,
      // and and divde by 1000 to convert ms to seconds.
      // We could do that here, but will move constants
      // to end...
      vol += ms * ht;
      if (isNaN(vol)) {
        debugger;
      }
    }
    return vol/(60*1000);
  }

  // This is based only on inhalations, and
  // is therefore functional when there is a check valve
  // in place. Such a system will rarely
  // have negative flows, and we must mark
  // the beginning of a breath from a transition to a "1"
  // state from any other state.
  // This algorithm is simple: A breath begins on a trasition
  // to 1 from a not 1 state. This algorithm is susceptible
  // to "stutter" near the boundary point, but if necessary
  // a digital filter would sove that; we have not yet found
  // that level of sophistication needed.
  // We still want to track zeros, but now must strack them
  // as a falling signal.

  function compute_breaths_based_without_negative_flow(transitions,flows) {
    var beg = 0;
    var zero = 0;
    var last = 0;
    var voli = 0;
    var vole = 0;

    var breaths = [];
    var expiring = false;

    for(var i = 0; i < transitions.length; i++) {
      // We're looking for the end of the inhalation here!!
      if (((i -1) >= 0) && transitions[i-1].state == 1 &&
          (transitions[i].state == 0 || transitions[i].state == -1 )) {
        zero = i;
      }
      if (expiring && transitions[i].state == 1) {
        breaths.push({ ms: transitions[i].ms,
		       sample: transitions[i].sample,
		       vol_e: vole,
		       vol_i: voli,
                       trans_begin_inhale: beg,
                       trans_cross_zero: zero,
                       trans_end_exhale: i,
		     }
		    );
        var w = PressureVolumeWork(breaths[breaths.length-1], transitions, samples);
        breaths[breaths.length-1].work = w;
        beg = i;
        expiring = false;
        vole = integrateSamples(last,transitions[i].sample,flows);

        last = transitions[i].sample;
      }
      if (!expiring && ((transitions[i].state == -1) || (transitions[i].state == 0)))  {
        expiring = true;
        voli = integrateSamples(last,transitions[i].sample,flows);
        last = transitions[i].sample;
      }
    }
    return breaths;
  }


// A simple computation of a moving window trace
// computing [A + -B], where A is volume to left
// of sample int time window t, and B is volume to right
// t is in milliseconds
function computeMovingWindowTrace(samples,t,v) {

  var flows = samples.filter(s => s.event == 'M' && s.type == 'F');

  if (flows.length == 0) {
    return [[],[]];
  }
  var first_time = flows[0].ms;
  var last_time = flows[flows.length - 1].ms;
  var duration = last_time - first_time;

  // Here is an idea...
  // We define you to be in one of three states:
  // Inspiring, expiring, or neither.
  // Every transition between these states is logged.
  // Having two inspirations between an expiration is
  // weird but could happen.
  // We record transitions.
  // When the time series crossed a fixed threshold
  // or zero, it causes a transition. If you are inspiring,
  // you have to cross zero to transition to neither,
  // and you start expiring when you cross the treshold.

  // This is measured in standard liters per minute.
  const vm = 10; // previously used 4

  // We will model this as a list of transitions.
  // A breath is any number of inspirations followed by
  // any number of expirations. (I+)(E+)

  var transitions = compute_transitions(vm,flows);

  // Now that we have transitions, we can apply a
  // diferrent algorithm to try to define "breaths".
  // Because a breath is defined as an inspiration
  // and then an expiration, we will define a breath
  // as from the first inspiration, until there has
  // been one expiration, until the next inspiration.
  var breaths = [];
  var expiring = false;

  function compute_breaths_based_on_exhalations(transitions) {
    var beg = 0;
    var zero = 0;
    var last = 0;
    var voli = 0;
    var vole = 0;

    // This code was robust when I breathed through a mask,
    // but on clean simulations with negative flow, seemes to
    // go awry...
    // It think really it makes more sense to find the first
    // transition from a non-inspiring state to an inspiring state
    // and start there.
    for(var i = 0; i < transitions.length; i++) {
      // We're looking for the end of the inhalation here!!
      if (((i -1) >= 0) && transitions[i-1].state == 1 && (transitions[i].state == 0 || transitions[i].state == -1 )) {
        zero = i;
      }
      if (expiring && transitions[i].state == 1) {
        breaths.push({ ms: transitions[i].ms,
		       sample: transitions[i].sample,
		       vol_e: vole,
		       vol_i: voli,
                       trans_begin_inhale: beg,
                       trans_cross_zero: zero,
                       trans_end_exhale: i,
		     }
		    );
        var w = PressureVolumeWork(breaths[0], transitions, samples);
        breaths[0].work = w;
        beg = i;
        expiring = false;
        vole = integrateSamples(last,transitions[i].sample,flows);
        last = transitions[i].sample;
      }
      if (!expiring && (transitions[i].state == -1)) {
        expiring = true;
        voli = integrateSamples(last,transitions[i].sample,flows);
        last = transitions[i].sample;
      }
    }
  }

  breaths = compute_breaths_based_without_negative_flow(transitions,flows);

  return [transitions,breaths];
}
