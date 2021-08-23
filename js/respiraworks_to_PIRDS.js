/*

respiraworks_to_PIRDS.js as a program specifically to convert
from the Respiraworks internal data format, which includes
a gret deal of meta-data, to the PIRDS data format.

Copyright (C) 2021 Robert L. Read

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.
You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/*
The respiraworks format is general, but in order to convert to PIRDS,
we need the following varialbes:

        "trace_variable_names": [
            "pc_setpoint",
            "pressure",
            "volume",
            "net_flow"
        ],
altough we have not need for volume. Addtionally, "time" is absolutely
necessary, and seems to be always present as the first trace in the
respiraworks set.
*/
var GLOBAL_DATASET;
// find trace by name
function get_trace(name,traces) {
  for(var i = 0; i < traces.length; i++) {
    var tr = traces[i];
    if (tr.variable_name == name) {
      return tr.data;
    }
  }
  return null;
}

function respiraworks_to_PIRDS(ra_text) {
  var ra = (typeof val === 'string') ? JSON.parse(ra_text) : ra_text;
  GLOBAL_DATASET = ra;
  var converted = ra.scenario.trace_variable_names;
  var traces = ra.traces;
  var times = get_trace("time",traces);
  var pressures = get_trace("pressure",traces);
  var flows = get_trace("net_flow",traces);
  if ((times.length != pressures.length) || (pressures.length != flows.length)) {
    console.log("MISMATCHED RESPIRAWORKS TRACE LENGTHS!");
  }
  var samples = [];
  for(var i = 0; i < times.length; i++) {
    var time = times[i];
    var ms = Math.round((times[i] - times[0]) * 1000);
    // We wil first create the pressure sample, then the flow,
    // converting to the PIRDS units
    var p_mm_H2O = Math.round(pressures[i] * 10);
    var psample = { event: "M",
                    type: "D",
                    loc: "I",
                   num: 0,
                    ms: ms,
                    val: p_mm_H2O };
    // Respiraworks uses ml/second, be PIRDS uses ml/min
    var flow_ml_per_min = Math.round(flows[i] * 60);
    var fsample = {event: "M",
                   type: "F",
                   loc: "I",
                   num: 0,
                   ms: ms,
                   val: flow_ml_per_min };
    samples.push(psample);
    samples.push(fsample);
  }
  return samples;
}
