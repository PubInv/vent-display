/*
The Vent-display project is a ventilator display that consumes PIRDS data and
performs most clinical respiration calculations. This is an important part of
Public Invention's goal of creating an open-source ventilator ecosystem. This
is a stand-alone .html file with about a thousand lines of JavaScript that
implements a clinical display that doctors want to see of an operating
ventilator. It includes live data trace plots of pressure and flow, as well as
calculated values such as tidal volume.
Copyright (C) 2021 Robert Read, Lauria Clarke, Ben Coombs, and Darío Hereñú.

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


var MAX_SAMPLES_TO_STORE_S = 2000;

const SMALL_HEIGHT = 500;
const LARGE_HEIGHT = 800;

CLINICAL_COLORS = {
  bg: "black",
  sidebar_bg: "black",
  pressure: "green",
  flow: "yellow",
  text_color: "yellow",
  
}
ENGINEERING_COLORS = {
  bg: "white",
  sidebar_bg: "AliceBlue",
  pressure: "red",
  flow: "blue",
  text_color: "black",
}


// I want a function to print times without milliseconds!!!!

if (!Date.prototype.toISOStringSeconds) {
  (function() {

    function pad(number) {
      if (number < 10) {
        return '0' + number;
      }
      return number;
    }

    Date.prototype.toISOStringSeconds = function() {
      return this.getUTCFullYear() +
        '-' + pad(this.getUTCMonth() + 1) +
        '-' + pad(this.getUTCDate()) +
        'T' + pad(this.getUTCHours()) +
        ':' + pad(this.getUTCMinutes()) +
        ':' + pad(this.getUTCSeconds()) +
        'Z';
    };

  })();
}

var TAIP_AND_TRIP_MIN = 2;
var TAIP_AND_TRIP_MAX = 8;

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

// These are defined in PIRDS.h as "constant" key words of special meaning...
var FLOW_LIMITS_EXCEEDED = false;
const FLOW_TOO_HIGH = "FLOW OUT OF RANGE HIGH";
const FLOW_TOO_LOW = "FLOW OUT OF RANGE LOW";

const SAMPLES_BETWEEN_FIO2_REPORTS = 30000;

const VENTMON_DATA_LAKE = "http://ventmon.coslabs.com/rds";
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
var TRACE_ID = urlParams.get('i');

// If the query params includes "raworks" (for Respiraworks),
// then we will behave somewhat differently.
// We will not do live processing, and will will hide
// the live url boxes, and place the url for the respiraworks file
// in a separate box.
var RESPIRAWORKS_OVERRIDE = urlParams.get('raworks');
var RESPIAWORKS_URL;
if (RESPIRAWORKS_OVERRIDE) {
  $("#livetoggle").prop("checked",false);
  $(".livecon").hide();
  RESPIRAWORKS_URL = RESPIRAWORKS_OVERRIDE;
  console.log(DSERVER_URL + "data/" + RESPIRAWORKS_OVERRIDE);
  $("#raworksid").val(RESPIRAWORKS_URL);
} else {
  $(".raworks").hide();
}
// This was problematic when the data server was in a different place...
// var DSERVER_URL = window.location.protocol + "//" + window.location.host;
var DSERVER_URL = "";
var NUM_TO_READ = 500;
var DESIRED_DURATION_S = 30;

var DATA_RETRIEVAL_PERIOD = 500;

var RESPIRATION_RATE_WINDOW_SECONDS = 60;

var intervalID = null;

// This sould be better as time, but is easier
// to do as number of samples.
// var MAX_SAMPLES_TO_STORE_S = 2000;
// var MAX_REFRESH = false;
// var INITS_ONLY = true;

var SAMPLES = [];

// This is just to get the party started!
function init_samples() {
    return [
	{
	    "event": "M",
	    "type": "P",
	    "ms": 19673310,
	    "loc": "A",
	    "num": "0",
	    "val": 10111
	},
	{
	    "event": "M",
	    "type": "D",
	    "ms": 19673310,
	    "loc": "A",
	    "num": "0",
	    "val": 4
	},
	{
	    "event": "M",
	    "type": "F",
	    "ms": 19673310,
	    "loc": "A",
	    "num": "0",
	    "val": 0
	},
	{
	    "event": "M",
	    "type": "P",
	    "ms": 19673376,
	    "loc": "A",
	    "num": "0",
	    "val": 10111
	},
	{
	    "event": "M",
	    "type": "D",
	    "ms": 19673376,
	    "loc": "A",
	    "num": "0",
	    "val": 4
	},
	{
	    "event": "M",
	    "type": "F",
	    "ms": 19673376,
	    "loc": "A",
	    "num": "0",
	    "val": 0
	},
	{
	    "event": "M",
	    "type": "P",
	    "ms": 19673442,
	    "loc": "A",
	    "num": "0",
	    "val": 10110
	},
	{
	    "event": "M",
	    "type": "D",
	    "ms": 19673442,
	    "loc": "A",
	    "num": "0",
	    "val": 3
	},
    ];
}

function get_pressure_and_flow_data_from_samples(samples) {

  var millis = unpack(samples, 'ms');
  var min = Math.min(...millis);
  var max = Math.max(...millis);
  var total_seconds = (max-min)/1000.0;
 var maxseconds = Math.ceil(total_seconds);

  var flows = samples.filter(s => s.event == 'M' && s.type == 'F');

  // These are slm/1000, or ml/minute...
  // so we multiply by 1000 to get liters per minute
  var flow_values = unpack(flows,"val").map(v => v * CONVERT_PIRDS_TO_SLM);
  var fmillis = unpack(flows, 'ms');
  // Convert to seconds...
  var fmin = Math.min(...fmillis);
  var fzeroed = fmillis.map(m =>(m-fmin)/1000.0);

  var pressures = samples.filter(s => s.event == 'M' && s.type == 'D' && (s.loc == 'A' || s.loc == 'I'));

  var pmillis = unpack(pressures, 'ms');
  var pmin = Math.min(...pmillis);
  var pzeroed = pmillis.map(m =>(m-pmin)/1000.0);

  // the PIRDS standard is integral mm H2O, so we divide by 10
  var delta_p = unpack(pressures, 'val').map(p => p / 10);
  return [maxseconds,pzeroed,delta_p,fzeroed,flow_values];

}
function get_pressure_and_flow_graphs_clinical(pzeroed,delta_p,fzeroed,flow_values,colors) {

      var diff_p = {type: "scatter", mode: "lines",
		  name: "pressure",
		  x: pzeroed,
		  y: delta_p,
		  line: {color: colors.pressure}
		 };

  var flow = {type: "scatter", mode: "lines",
		name: "flow",
		x: fzeroed,
	      y: flow_values,
              xaxis: 'x2',
              yaxis: 'y2',
              fill: 'tozeroy',
		line: {color: colors.flow}
             };
  return [diff_p,flow];
}

function plot_clinical(samples,transistions,breaths) {

  const [max_seconds,pzeroed,delta_p,fzeroed,flow_values] = get_pressure_and_flow_data_from_samples(samples);

  const pressure_and_flow = get_pressure_and_flow_graphs_clinical(pzeroed,delta_p,fzeroed,flow_values,CLINICAL_COLORS);
      var layout = {
//      title: SEVENINCHEL14TS ? '' : 'VentMon Breath Analysis',
      height: SEVENINCHEL14TS ? SMALL_HEIGHT : LARGE_HEIGHT,
      // Here I attempt to match Paulino's style
      plot_bgcolor: CLINICAL_COLORS.bg,
      paper_bgcolor : CLINICAL_COLORS.bg,
      showlegend: false,

      xaxis: {domain: [0.0,1.0],
              range : [0,max_seconds],
              tickfont: {color: CLINICAL_COLORS.pressure}},
      yaxis: {
        title: 'P(cm H2O)',
        titlefont: {color: CLINICAL_COLORS.pressure},
        tickfont: {color: CLINICAL_COLORS.pressure},
      },
      xaxis2: {domain: [0.0,1.0],
               range : [0,max_seconds],
               tickfont: {color: CLINICAL_COLORS.flow}},
      yaxis2: {
        title: 'l/min',
        titlefont: {color: CLINICAL_COLORS.flow},
        tickfont: {color: CLINICAL_COLORS.flow}
      },
      grid: {
        rows: 2,
        columns: 1,
        pattern: 'independent',
        roworder: 'top to bottom'}
    }
  Plotly.newPlot('PFGraph',
                 pressure_and_flow,
                 layout,
                 {displayModeBar: false,
                  displaylogo: false,
                  responsive: true});

}
function render_samples_clinical(samples) {
  var [max_seconds,pzeroed,delta_p,fzeroed,flow_values] = get_pressure_and_flow_data_from_samples(samples);

  var pressure_and_flow = get_pressure_and_flow_graphs_clinical(pzeroed,delta_p,fzeroed,flow_values,CLINICAL_COLORS);

  const t = 200; // size of the window is 200ms
  const v = 50; // min volume in ml
  var [transitions,breaths] = computeMovingWindowTrace(samples,t,v);
  SAMPLES = samples;

  plot_clinical(samples,transitions,breaths);
  compute_and_render_observations(samples,transitions,breaths);
}


// function unpack(rows, key) {
//     return rows.map(function(row) { return row[key]; });
// }

// const CONVERT_PIRDS_TO_SLM = 1/1000;

function plot_engineering(samples, trans, breaths) {
  var new_data = samplesToLine(samples,ENGINEERING_COLORS);
  var millis = unpack(samples, 'ms');
  var min = Math.min(...millis);
  var zeroed = millis.map(m =>(m-min)/1000.0);
  var max = Math.max(...millis);
  var total_seconds = (max-min)/1000.0;


  // The Y-axis for the events will be percentage.
  // This is somewhat abstract; each trace has
  // a different meaning. In general it will be
  // % as a function of some known value, which
  // will be either a limit or a min or max.
    var event_graph = [];
    if (trans) {
      // Transitions are simply scaled to 50%.
      var tmillis = unpack(trans, 'ms');
      var tzeroed = tmillis.map(m =>(m-min)/1000.0);
      var tstates = unpack(trans, 'state');
      var tstates_amped = tstates.map(m =>m*50);
      var transPlot = {type: "scatter",
                       mode: "lines+markers",
		       name: "trans",
		       x: tzeroed,
		       y: tstates_amped,
                     xaxis: 'x3',
                     yaxis: 'y3',
                       line: {shape: 'hv',
                              color: 'dkGreen'},
		      };
      // We add a hollow flow line to see in position..
      event_graph.push(new_data[2]);
      event_graph.push(transPlot);
    }

    if (breaths) {
      var bmillis = unpack(breaths, 'ms');
      var bzeroed = bmillis.map(m =>(m-min)/1000.0);
      // I'm goint to a add start and end transition to make the plot
      // come out right
      var ys = breaths.map( b => 0);
      var breathPlot = {type: "scatter", mode: "markers",
		        name: "Transitions",
		        x: bzeroed,
		        y: ys,
                     xaxis: 'x3',
                     yaxis: 'y3',
		        marker: { size: 8, color: "red",symbol: "diamond" },
                        textposition: 'bottom center',
                        text: bzeroed
		       };
      event_graph.push(breathPlot);
      // Now I attempt to extract volumes...
      // Our breaths mark the END of a breath..
      // so we want to draw the volumes that way.
      const volume_ht_factor = 20;
      var max_exh = unpack(breaths,'vol_e').reduce(
        function(a, b) {
          return Math.max(Math.abs(a), Math.abs(b));
        }
        ,0);
      var max_inh = unpack(breaths,'vol_i').reduce(
        function(a, b) {
          return Math.max(Math.abs(a), Math.abs(b));
        }
        ,0);
      var max_v = Math.max(max_inh,max_exh);

      // not sure why I have null work, have to understand.
      var max_work_per_liter = 0;
      var work_per_liter = [];
      for(var i = 0; i < breaths.length; i++) {
        var b = breaths[i];
        if (b.work != null) {
          var wpl = b.work / b.vol_i;
          if (wpl > max_work_per_liter)
            max_work_per_liter = wpl;
          var center = ((trans[b.trans_begin_inhale].ms + trans[b.trans_cross_zero].ms) - 2*min) / (2.0 * 1000.0);
          work_per_liter.push({ wpl: wpl, center: center });
        }
      }

      var exh_v = unpack(breaths, 'vol_e').map(e => 100 * e / max_v);
      var t_exh_v =  unpack(breaths, 'vol_e').map(e => Math.round(e*1000.0)+"ml exh");
      var inh_v = unpack(breaths, 'vol_i').map(i => 100 * i / max_v);
      var t_inh_v = unpack(breaths, 'vol_i').map(e => Math.round(e*1000.0)+"ml inh");


      var work_v = work_per_liter.map(w => (1/3) * (100 * w.wpl / max_work_per_liter));
      var t_work = work_per_liter.map(w => w.wpl.toFixed(2)+"J/L");
      var work_centers = unpack(work_per_liter, 'center');

      // now to graph properly, I must find the center of an inhalation.
      // I have packed these into the breaths...
      var inhale_centers = breaths.map(b => ((trans[b.trans_begin_inhale].ms + trans[b.trans_cross_zero].ms) - 2*min) / (2.0 * 1000.0));
      var exhale_centers = breaths.map(b => ((trans[b.trans_cross_zero].ms + trans[b.trans_end_exhale].ms) - 2*min) / (2.0 * 1000.0));

      var inhPlot = {type: "scatter", mode: "markers+text",
                     name: "Inh. ml",
                     textposition: 'bottom center',
                     x: inhale_centers,
                     y: inh_v,
                     xaxis: 'x3',
                     yaxis: 'y3',
                     text: t_inh_v,
                     marker: { size: 8,
                               color: 'black',
                               symbol: 'triangle-down'}
                    };
      var exhPlot = {type: "scatter", mode: "markers+text",
                     name: "Exh. ml",
                     textposition: 'top center',
                     marker : {
                       sizer: 12,
                       color: 'green',
                       symbol: 'triangle-up' },
                     x: exhale_centers,
                     y: exh_v,
                     xaxis: 'x3',
                     yaxis: 'y3',
                     text: t_exh_v,

                    };
      var workPlot = {type: "scatter", mode: "markers+text",
                     name: "WoB J",
                     textposition: 'bottom center',
                     x: work_centers,
                     y: work_v,
                     xaxis: 'x3',
                     yaxis: 'y3',
                     text: t_work,
                     marker: { size: 8,
                               color: 'blue',
                               symbol: 'triangle-right'}
                     };
      event_graph.push(workPlot);
      event_graph.push(inhPlot);
      event_graph.push(exhPlot);
    }

    // Now I will attempt to add other markers, such as Humidity, Altitude, and other events,
    // including possible warning events.

    function gen_graph_measurement(samples, name, color, textposition, tp, lc0, lc1, vf, tf) {
      var selected = samples.filter(s => s.event == 'M' && s.type == tp && (s.loc == lc0 || s.loc == lc1));
      return gen_graph(selected, name, color, textposition, vf, tf);
    }

    function gen_graph_measurement_timed(samples, name, color, textposition, tp, lc0, lc1, vf, tf,time_window_ms) {
      var messages = samples.filter(s => s.event == 'M' && s.type == tp && (s.loc == lc0 || s.loc == lc1));
      var separated = [];
      for(var i = 0; i < messages.length; i++) {
        var m = messages[i];
        if ((separated.length == 0) || ((separated.length > 0) && (separated[separated.length-1].ms < (m.ms - time_window_ms))))
          separated.push(m);
      }
      return gen_graph_measurement(separated, name, color, textposition, tp, lc0, lc1, vf, tf);
    }

    function gen_graph(selected,name,color, textposition, vf, tf) {
      var millis = unpack(selected, 'ms');
      var zeroed = millis.map(m =>(m-min)/1000.0);
      var vs = selected.map(vf);
      var vs_t = vs.map(tf);
      var plot = {type: "scatter", mode: "markers+text",
                     name: name,
                     textposition: textposition,
                     x: zeroed,
                     y: vs,
                     xaxis: 'x3',
                     yaxis: 'y3',
                     text: vs_t,
                     marker: { size: 10, color: color }
                    };
      return plot;

    }
    function gen_message_events(samples,name,color, textposition) {
      var messages = samples.filter(s => s.event == 'E' && s.type == 'M');
      // Now I want to filter our all flow error messages...
      // There are two special ones, "FLOW OUT OF RANGE LOW" and
      // "FLOW OUT OF RANGE HIGH"
      // Basically, we will show only the first of these in a "run"
      // This is rather difficult; we will instead just use 200 ms
      // as a window.
      const TIME_WINDOW_MS = 400;

      var lows = [];
      var highs = [];
      var others = [];
      for(var i = 0; i < messages.length; i++) {
        var m = messages[i];
        if (m.buff == FLOW_TOO_LOW) {
          if ((lows.length == 0) || ((lows.length > 0) && (lows[lows.length-1].ms < (m.ms - TIME_WINDOW_MS))))
            lows.push(m);
        } else if (m.buff == FLOW_TOO_HIGH) {
          if ((highs.length == 0) || ((highs.length > 0) && (highs[highs.length-1].ms < (m.ms - TIME_WINDOW_MS))))
            highs.push(m);
        } else {
          others.push(m);
        }
      }
      if (lows.length > 0 || highs.length > 0) {
        set_flow_alert();
      } else {
        unset_flow_alert();
      }

      var lowsPlot = gen_graph(lows,"Low Range","blue",'top center',
                                    (s => -90.0),
                                    (v =>  "LOW"));
      var highsPlot = gen_graph(highs,"High Range","red",'bottom center',
                                    (s => 90.0),
                                    (v =>  "HIGH"));
      var othersPlot = gen_graph(others,"messages","Aqua",'top center',
                                    (s => -75.0),
                                 (v =>  v.buff));
      return [lowsPlot,highsPlot,othersPlot];
    }
    {
      var fio2AirwayPlot = gen_graph_measurement_timed(samples,
                                                 "FiO2 (%)",
                                                       "Black",'top center','O','I','A',
                                                 (s => s.val),
                                                 (v =>  "FiO2 : "+v.toFixed(1)+"%"),
                                                 // O2 reported only once every 10 seconds
                                                SAMPLES_BETWEEN_FIO2_REPORTS);
      event_graph.push(fio2AirwayPlot);
    }

    {
      var humAirwayPlot = gen_graph_measurement(samples,"Hum (%)","Aqua",'top center','H','I','A',
                              (s => s.val/100.0),
                              (v =>  "H2O : "+v.toFixed(0)+"%"));
      event_graph.push(humAirwayPlot);
    }

    {
      // "null" here will never be matched, which is correct
      var humAmbientPlot = gen_graph_measurement(samples,"Hum (%)","CornflowerBlue",'bottom center','H','B',null,
                              (s => -s.val/100.0),
                                      (v =>  "H2O (B): "+(-v).toFixed(0)+"%"));
      event_graph.push(humAmbientPlot);
    }

    {
      var tempAirwayPlot = gen_graph_measurement(samples,"Temp A","red",'bottom center','T','I','A',
                              (s => s.val/100.0),
                              (v =>  "T (I): "+v.toFixed(1)+"C"));
      event_graph.push(tempAirwayPlot);
    }

    {
      var tempAmbientPlot = gen_graph_measurement(samples,"Temp B","orange",'top center','T','B',null,
                              (s => -s.val/100.0),
                                      (v =>  "T (B): "+(-v).toFixed(1)+"C"));
      event_graph.push(tempAmbientPlot);
    }

    // Altitude is really just a check that the system is working
     {
       var altAmbientPlot = gen_graph_measurement(samples,"Altitude","purple",'right','I','B',null,
                              (s => s.val/20.0),
                                      (v =>  "Alt: "+(v*20.0).toFixed(0)+"m"));
      event_graph.push(altAmbientPlot);
     }

     {
       var [l,h,o] = gen_message_events(samples,"Message","red",'right');
       event_graph.push(l);
       event_graph.push(h);
       event_graph.push(o);
     }


    // I'm going to try putting the pressure
    // in faintly to make the graphs match

    var event_layout = {
      title: SEVENINCHEL14TS ? '' : 'Events',
      showlegend: false,
      height: SEVENINCHEL14TS ? SMALL_HEIGHT : LARGE_HEIGHT,
      xaxis: {domain: [0.0,1.0]},
      yaxis: {
        range: [-100.0, 100.0]
      },
    };


  // Here we produce the first two graphs...
  // This actually needs to be computed, I need to clean time up in general.

  var maxseconds = Math.ceil(total_seconds);
    var layout = {
      title: SEVENINCHEL14TS ? '' : 'VentMon Breath Analysis',
      height: SEVENINCHEL14TS ? SMALL_HEIGHT : LARGE_HEIGHT,
      showlegend: false,

      xaxis: {domain: [0.0,1.0],
              range : [0,maxseconds]},
      yaxis: {
        title: 'P(cm H2O)',
        titlefont: {color: 'red'},
        tickfont: {color: 'red'},
      },
      xaxis2: {domain: [0.0,1.0],
              range : [0,maxseconds]},
      yaxis2: {
        title: 'l/min',
        titlefont: {color: 'blue'},
        tickfont: {color: 'blue'}
      },
      xaxis3: {domain: [0.0,1.0],
              range : [0,maxseconds]},
      yaxis3: {
        range: [-100.0, 100.0]
      },
      grid: {
        rows: 3,
        columns: 1,
        pattern: 'independent',
        roworder: 'top to bottom'}
    }
    var test = {type: "scatter", mode: "lines",
		name: "flow",
		x: [0,0.1,0.2,0.3,0.4],
	        y: [40,50,-30,20,60],
              xaxis: 'x3',
              yaxis: 'y3',
              fill: 'tozeroy',
		line: {color: '#0000FF'}
             };

//  event_graph.push(test);
  var triple_plot = [new_data[0],new_data[1],...event_graph];

   Plotly.newPlot('PFGraph',
                   triple_plot,
                   layout,
                   {displayModeBar: false,
                    displaylogo: false,
                    responsive: true});

}

function set_flow_alert() {
  $("#main_alert").show();
}
function unset_flow_alert() {
  $("#main_alert").hide();
}

function check_alarms(limits,key,limit,val,f,ms) {
  var alarms = [];
  if (limits[key][limit] && (f(val,limits[key][limit]))) {
    alarms.push({param: key,
                 limit: limit,
                 val: val,
                 ms: ms});
  }
  return alarms;
}


var LIMITS = {
  max: { h: 40,
         l: 0},
  avg: { h: 30,
         l: 0},
  min: { h: 10,
         l: -10},
  mv: { h: 10,
         l: 1},
  bpm: { h: 40,
         l: 5},
  ier: { h: 4,
         l: 0.25},
  tv: { h: 1000,
         l: 200},
  fio2: { h: 100,
         l: 18},
  taip: { h: 100, // These are in ms
         l: 0},
  trip: { h: 100, // These are in ms
          l: 0},
  wob: { h: 3,
         l: 0.2},
}

function load_ui_with_defaults(limits) {
  var Lkeys = Object.keys(limits);
  Lkeys.forEach((key,index) => {
    ["h","l"].forEach(limit => {
      $("#"+key+"_"+limit).val(limits[key][limit]);
    })
  });
}

function set_rise_time_pressures()
{
  $("#tarip_l").val(TAIP_AND_TRIP_MIN);
  $('#tarip_l').change(function () {
    TAIP_AND_TRIP_MIN = $("#tarip_l").val();
  });
  $("#tarip_h").val(TAIP_AND_TRIP_MAX);
  $('#tarip_h').change(function () {
    TAIP_AND_TRIP_MAX = $("#tarip_h").val();
  });
}

function reflectAlarmsInGUI(alarms) {
  var Lkeys = Object.keys(LIMITS);
  Lkeys.forEach((key,index) => {
    ["h","l"].forEach(limit => {
      var alarms_for_key = alarms.filter(s => s.param == key && s.limit == limit);
      if (alarms_for_key.length > 0) {
        $("#"+key).addClass("alarmred");
        $("#"+key+"_"+limit).addClass("alarmred");
      } else {
        $("#"+key).removeClass("alarmred");
        $("#"+key+"_"+limit).removeClass("alarmred");
      }
    })
  });
}
const d = new Date();
const TZ_OFFSET_MS = d.getTimezoneOffset()*60*1000;

var LAST_SAMPLE_DATE;
function get_date_of_sample(timestring,time_mark,ms) {
  var d = new Date(timestring);
  var t = d.getTime();
  var tm = t - TZ_OFFSET_MS + (ms - time_mark);
  return new Date(tm);
}

// epoch_ms is the milliseconds since the beginning of UNIX epoch
function get_date_of_sample_simple(epoch_ms) {
  var d = new Date();
  var s = Math.floor(epoch_ms/1000);
  var ms_in_s = epoch_ms-s;
  var t = d.setTime(s);
  d.setUTCMilliseconds(ms_in_s);
  return d;
}

function compute_and_render_observations(samples,transitions,breaths) {
  // How many seconds backwards should we look? Perhaps 20?
  var [bpm,tv,mv,EIratio,wob] = compute_respiration_rate(RESPIRATION_RATE_WINDOW_SECONDS,samples,transitions,breaths);

  var alarms = [];

  // To set the custom element, we select the
  // span to modify. The first is the title,
  // the second is the value.
  $("#bpm span:nth-child(2)").text(bpm.toFixed(1));

  $("#tidalvolume span:nth-child(2").text(tv.toFixed(0));
  $("#mv span:nth-child(2)").text(mv.toFixed(2));

  if (wob == "NA") {
    $("#workofbreathing span:nth-child(2)").text("NA");
  } else {
    $("#workofbreathing span:nth-child(2)").text(wob.toFixed(2));
  }
  if (EIratio == "NA") {
    $("#inhalationtoexhalation span:nth-child(2)").text("NA");
  } else {
    $("#inhalationtoexhalation span:nth-child(2)").text((1.0 / EIratio).toFixed(1));
  }

  var final_ms = samples[samples.length -1].ms;
  var b_ms = 0;
  if (breaths.length > 0) {
    b_ms = breaths[breaths.length -1].ms;
  } else {
    b_ms = final_ms;
  }
  function check_high_and_low(limits,key,v,ms) {
    var al1 = check_alarms(limits,key,"h",v,(a,b) =>(a > b),ms);
    var al2 = check_alarms(limits,key,"l",v,(a,b) =>(a < b),ms);

    return al1.concat(al2);
  }

  alarms = alarms.concat(check_high_and_low(LIMITS,"bpm",bpm.toFixed(1),b_ms));
  alarms = alarms.concat(check_high_and_low(LIMITS,"tv",tv.toFixed(0),b_ms));
  alarms = alarms.concat(check_high_and_low(LIMITS,"mv",mv.toFixed(2),b_ms));
  alarms = alarms.concat(check_high_and_low(LIMITS,"ier",(1.0 / EIratio).toFixed(1),b_ms));
  if (wob != "NA")
    alarms = alarms.concat(check_high_and_low(LIMITS,"wob",wob.toFixed(2),b_ms));

  // These must be moved out; in fact,
  // they must be made configurable!

  var taip = compute_mean_TRIP_or_TAIP(
    TAIP_AND_TRIP_MIN,
    TAIP_AND_TRIP_MAX,
    samples,
    true);
  if (taip != "NA") {
    $("#timeachieve-ip span:nth-child(2)").text(taip.toFixed(1));
    alarms = alarms.concat(
      check_high_and_low(LIMITS,"taip",taip,b_ms));
  } else {
    $("#timeachieve-ip span:nth-child(2)").text("NA");
  }

  var trip = compute_mean_TRIP_or_TAIP(
    TAIP_AND_TRIP_MIN,
    TAIP_AND_TRIP_MAX,
    samples,
    false);
  if (trip != "NA") {
    $("#timereleaseinspiratorypressure span:nth-child(2)").text(trip.toFixed(1));
    alarms = alarms.concat(
      check_high_and_low(LIMITS,"trip",trip,b_ms));
  } else {
    $("#timereleaseinspiratorypressure span:nth-child(2)").text("NA");
  }

  var [min,avg,max,palarms] = compute_pressures(RESPIRATION_RATE_WINDOW_SECONDS,samples,alarms,LIMITS);
  alarms = alarms.concat(palarms);

  $("#pipmax span:nth-child(2)").text(max.toFixed(1))
  $("#pipavg span:nth-child(2)").text(avg.toFixed(1))
  $("#pipmin span:nth-child(2)").text(min.toFixed(1))


  var fio2 = compute_fio2_mean(RESPIRATION_RATE_WINDOW_SECONDS,samples);

   if(fio2 == null){
    $("#fioxygen2 span:nth-child(2)").text("NA");
   } else {
    alarms = alarms.concat(check_high_and_low(LIMITS,"fio2",fio2.toFixed(1),b_ms));
    $("#fioxygen2 span:nth-child(2)").text(fio2.toFixed(1));
   }

  reflectAlarmsInGUI(alarms);

  // Return date in UTC time (as it comes to us)
  function time_of_extreme_samples(samples) {
//    var messages = samples.filter(s => s.event == 'E' && s.type == 'C');
    // if our traces don't have monotone ms fields, this is an
    // unrecoverable error...
    var cur = 0;
    for(var i = 0; i < samples.length; i++) {
      if (samples[i].ms <= 0) { // This is an error!!!
        console.log("error, non-monotonic ms times");
        return [null,null];
      }
      cur = samples[i].ms;
    }
    var first_ms = samples[0].ms;
    var last_ms = samples[samples.length-1].ms;
    return [get_date_of_sample_simple(first_ms),
            get_date_of_sample_simple(last_ms)];
  }
  var [start,finish] = time_of_extreme_samples(samples);
  $("#time_start").text((start) ? start.toISOStringSeconds() : null);
  $("#time_finish").text((finish) ? finish.toISOStringSeconds() : null);
  LAST_SAMPLE_DATE = finish;
}

// TODO: In this case, we are not using pressure_and_flow,
// which IS used by the clinical plot. This is a major disruption.
function render_samples_engineering(samples) {
  if (!samples) return;
  SAMPLES = samples;
  const t = 200; // size of the window is 200ms
  const v = 50; // min volume in ml
  var [transitions,breaths] = computeMovingWindowTrace(samples,t,v);
  plot_engineering(samples,transitions,breaths);

  compute_and_render_observations(samples,transitions,breaths);
//  console.log("process",start);
//  console.log("process",finish);
}

// make this take maxesonds and pressure and flow
function processSamplesAndDates(cur_sam) {
  // WARNING: This is a hack...if the timestamp is negative,
  // we treat it as a limited (beyond range of sensor) measurement.
  // Our goal is to warn about this, but for now we will just
  // ignore and correct.
  MAX_REFRESH = false;
  if (cur_sam == null) {
    console.log("No return");
    return;
  }
  //            console.log("returned ",cur_sam.length,cur_sam);
  if (cur_sam && cur_sam.length == 0) {
    // This is no longer true now that we are asking for time...
    //   console.log("no samples; potential misconfiguration!");
    LAST_SAMPLE_DATE = REQUEST_FINAL_SAMPLE;
  } else {
    if (typeof(cur_sam) == "string") {
      console.log("Error!",cur_sam);
      stop_interval_timer();
      $("#livetoggle").prop("checked",false);
      console.log(cur_sam);
    } else {
//      cur_sam = sanitize_samples(cur_sam);
      if (INITS_ONLY) {
	samples = cur_sam;
	INITS_ONLY = false;
      } else {
        samples = add_samples(samples,cur_sam);
        console.log("cursuam: a,z : ",cur_sam[0].ms,cur_sam[cur_sam.length-1].ms);
        var first_new_ms = cur_sam[0].ms;
      }
    }

    // Now we will trim off samples if we are live...
    if (intervalID) {
      var last_ms = samples[samples.length-1].ms
      samples = samples.filter((s, index, self) =>
        s.ms >= (last_ms - DESIRED_DURATION_S*1000));
    }
    //              console.log(samples);
    if (samples.length > 0)
      render_samples_engineering(samples);
    console.log("END",LAST_SAMPLE_DATE);
  }
}


// we have now changed this, there will be flow and
// pressure in the same samples, and we should filter.
// TODO: I need to add maximal start and end
// samples to equalize all the plots.
function samplesToLine(samples,colors) {
    var flows = samples.filter(s => s.event == 'M' && s.type == 'F');

    // These are slm/1000, or ml/minute...
    // so we multiply by 1000 to get liters per minute
    var flow_values = unpack(flows,"val").map(v => v * CONVERT_PIRDS_TO_SLM);
    var fmillis = unpack(flows, 'ms');
    // Convert to seconds...
    var fmin = Math.min(...fmillis);
    var fzeroed = fmillis.map(m =>(m-fmin)/1000.0);

  var pressures = samples.filter(s => s.event == 'M' && s.type == 'D' && (s.loc == 'A' || s.loc == 'I'));

    var pmillis = unpack(pressures, 'ms');
    var pmin = Math.min(...pmillis);
    var pzeroed = pmillis.map(m =>(m-pmin)/1000.0);
    // the PIRDS standard is integral mm H2O, so we divide by 10
    var delta_p = unpack(pressures, 'val').map(p => p / 10);
    var diff_p = {type: "scatter", mode: "lines",
		  name: "pressure",
		  x: pzeroed,
		  y: delta_p,
		  line: {color: colors.pressure}
		 };

  var flow = {type: "scatter", mode: "lines",
		name: "flow",
		x: fzeroed,
	      y: flow_values,
              xaxis: 'x2',
              yaxis: 'y2',
              fill: 'tozeroy',
		line: {color: colors.flow}
             };

  var max_flow = flow_values.reduce(
    function(a, b) {
      return Math.max(Math.abs(a), Math.abs(b));
    }
    ,0);
  var scaled_flow = flow_values.map(f => 100.0 * (f / max_flow));
  var flow_hollow = {type: "scatter", mode: "lines",
		name: "flow ghost",
		     x: fzeroed,
                     // Convert to a percentage
	             y: scaled_flow,
                     xaxis: 'x3',
                     yaxis: 'y3',
		line: {color: '#8888FF'}
               };
  return [diff_p,flow,flow_hollow];
}


// function processNewSamples(samples) {
//   var new_data = samplesToLine(samples,colors);
//   var millis = unpack(samples, 'ms');
//   var min = Math.min(...millis);
//   var zeroed = millis.map(m =>(m-min)/1000.0);
//   var max = Math.max(...millis);
//   var total_seconds = (max-min)/1000.0;
//   var pressure_and_flow = [new_data[0],new_data[1]];

//   var maxseconds = Math.ceil(total_seconds);

//   return [maxseconds,samples,pressure_and_flow];
// }


var REQUEST_FINAL_SAMPLE;

// TODO: This is bad when it fires another request while a request is in play.
function retrieveAndPlot(){
  var trace_piece = (TRACE_ID) ? "/" + TRACE_ID : "";
  // Note: This does not exist in the touch screen version
  // I am not sure how to deal with this, this is experimental
  DSERVER_URL = $("#dserverurl").val();
  DSERVER_URL = (DSERVER_URL ?  DSERVER_URL : "");
  var url;

  var TREAT_LIVE_AND_OVERRIDE_TIME = true;
  if (TREAT_LIVE_AND_OVERRIDE_TIME || (MAX_REFRESH || samples.length == 0) || !LAST_SAMPLE_DATE) {

    if ($("#simulation").is(":checked")) {
        url =  DSERVER_URL + trace_piece + "/"+ MAX_SAMPLES_TO_STORE_S;
    } else {
      url =  DSERVER_URL + "/rds" + trace_piece + "/json?n="+ MAX_SAMPLES_TO_STORE_S;
    }
  } else {
    url = DSERVER_URL + "/rds" +  trace_piece + "/json?n="+  NUM_TO_READ +
      "&t=" + encodeURIComponent(LAST_SAMPLE_DATE.toUTCString());
  }

  //
  // Our basic rule is:
  // if we are live and we have samples,
  // we always set z= to the last sample.
  if (!TREAT_LIVE_AND_OVERRIDE_TIME) {
    if (intervalID  && LAST_SAMPLE_DATE) {
      var currentDate = new Date();
      var t = currentDate.getTime();
      var tm = t - DESIRED_DURATION_S*1000;
      var t_max = Math.max(tm,LAST_SAMPLE_DATE.getTime());
      var date_minus_duration = new Date(t_max);

      url = DSERVER_URL +"/rds"+ trace_piece + "/json?n="+  NUM_TO_READ +
        "&a=" + encodeURIComponent(date_minus_duration.toUTCString()) +
        "&z=" + encodeURIComponent(currentDate.toUTCString());
      REQUEST_FINAL_SAMPLE = currentDate;
      //    console.log("A",date_minus_duration);
      //    console.log("Z",currentDate);
    } else {
    }
  }

  // WARNING! If the RESPIRAWORKS_OVERRIDE is specified,
  // then it is unclear if we should use the logic here.
  if (RESPIRAWORKS_OVERRIDE) {
    console.log("FILENAME OVERRIDE");
    console.log(RESPIRAWORKS_URL);
    $.ajax({url: RESPIRAWORKS_URL,
          success: function(ra){
            var converted = respiraworks_to_PIRDS(ra);
            processSamplesAndDates(converted);
          },
          error: function(xhr, ajaxOptions, thrownError) {
	    console.log("FILE_NAME Error!" + xhr.status);
	    console.log(thrownError);
            stop_interval_timer();
            $("#livetoggle").prop("checked",false);
          }
           });
  } else {
    if ($("#simulation").is(":checked")) {
      if ($("#clinical_display").is(":checked")) {
        getPIRDSData(DSERVER_URL,render_samples_clinical,stop_interval_timer);
      } else {
        getPIRDSData(DSERVER_URL,render_samples_engineering,stop_interval_timer);
      }
    } else {
      $.ajax({url: url,
              success: function(cur_sam){
                var tsamples = add_samples(SAMPLES,cur_sam);
                if ($("#clinical_display").is(":checked")) {
                  render_samples_clinical(tsamples);
                } else {
                  render_samples_engineering(tsamples);
                }

              },
              error: function(xhr, ajaxOptions, thrownError) {
	        console.log("Error!" + xhr.status);
	        console.log(thrownError);
                stop_interval_timer();
                $("#livetoggle").prop("checked",false);
              }
             });
    }
  }
}


$("#useofficial").click(function() {
    DSERVER_URL = VENTMON_DATA_LAKE;
    $("#dserverurl").val(DSERVER_URL);
});

$("#import").click(function() {
    var input_trace = $("#json_trace").val();
    samples = JSON.parse(input_trace);
});

$("#export").click(function() {
    $("#json_trace").val(JSON.stringify(samples,null,2));
});


  // Experimental timing against the data server

function stop_interval_timer() {
  clearInterval(intervalID);
  intervalID = null;
  $("#livetoggle").prop("checked",false);
}
function start_interval_timer() {
  if (intervalID) {
    stop_interval_timer();
  }
  intervalID = setInterval(
    function() {
      retrieveAndPlot();
    },
    DATA_RETRIEVAL_PERIOD);
  $("#livetoggle").prop("checked",true);
}
function toggle_interval_timer() {
  if (intervalID) {
    stop_interval_timer();
  } else {
    start_interval_timer();
  }
}

function setLimit(ed) {
  if(ed.which == 13) {
    var id = ed.target.id;
    var v = $("#"+id).val();
    var vf = parseFloat(v);
    var destruct = id.split("_");
    LIMITS[destruct[0]][destruct[1]] = isNaN(vf) ? null : vf;
  }
}

// CONTROL PANEL FUNCTIONS START



// CONTROL PANEL FUNCTIONS END

$(".fence").keypress(setLimit);

$("#livetoggle").change(toggle_interval_timer);

$("#startoperation").click(start_interval_timer);

$("#stopoperation").click(stop_interval_timer);


function sendOnePIRCS(k,val) {
  var url;
  var GET_OR_POST;
  if ($("#simulation").is(":checked")) {
    // Note the slash at the end is needed
    url =  DSERVER_URL + "/control/";
    GET_OR_POST = 'POST';
  } else {
    url = 'http://localhost:5000/api/pircs/'
    GET_OR_POST = 'GET';
  }
  $.ajax({
    //url: lh+"/api/pircs?com=C&par="+parName+"&int="+interp+"&mod="+modifier+"&val="+val,
    type: GET_OR_POST,
    url: url,
    dataType: 'json',
    data: { com: "C", par: k, int: "T", mod: 0, val: val }
  }).done(function(result) {
    console.log("result: " + JSON.stringify(result));
  }).fail(function(xhr, ajaxOptions, thrownError) {
    console.log("Error! " + xhr.status);
    console.log(thrownError);
  })
}

// These are our control modes...
var CONTROL_SETTINGS = { mode: "PCV",
                         pimax: 200,
                         TV: 400,
                         RR: 100,
                         IE: 20,
                         PEEP: 50 };


// Send PIRCS commands when START button is pressed
    $("#control-start").click(
      async function(event) {
        // Send a command to a connected device via serial port
        console.log("Sending PIRCS...");
        //Note: PIRCS uses specific units,
        // which are designed to provide the right
        // amount of precision without using
        // floating point numbers.
        // Often this means multiplying the
        // common medical units by 10 to be the
        // PIRCS units.
        var dict = {
          M: $("#control-mode").val(),
          B: $("#control-rr").val()*10,
          I: $("#control-ie").val(),
          V: $("#control-vinsp").val(),
          P: $("#control-pinsp").val()*10,
          E: $("#control-peep").val()*10,
        }

        function sleep(ms) {
          return new Promise(resolve => setTimeout(resolve, ms));
        }

        for (var k in dict){
          // WARNING!!!!
          // This is a workaround because we can easily create
          // buffer overruns on the serial port of the an ESP32
          // or Arduino. This really needs to be addressed in
          // our Node Server, AND also made more robust in VentOS.
          await sleep(500);
          sendOnePIRCS(k,dict[k]);
        }
      });

// Update values on slider change
$("#control-mode").on("input", () => {
  var m = $("#control-mode").val();
  if (m === "0"){
    $("#control-mode-val").html("PCV");
  } else if (m === "1"){
    $("#control-mode-val").html("VCV");
  } else {
    $("#control-mode-val").html("PSV");
  }
});
$("#control-rr").on("input", () => {
  $("#control-rr-val").html($("#control-rr").val());
});
$("#control-ie").on("input", () => {
  $("#control-ie-val").html($("#control-ie").val());
});
$("#control-pinsp").on("input", () => {
  $("#control-pinsp-val").html($("#control-pinsp").val());
});
$("#control-vinsp").on("input", () => {
  $("#control-vinsp-val").html($("#control-vinsp").val());
});
$("#control-peep").on("input", () => {
  $("#control-peep-val").html($("#control-peep").val());
});


$( document ).ready(function() {

  $("#control-slot").hide();
  // CONTROL PANEL INIT START
  $("#show_controls").click(function() {
    $("#control-slot").toggle();
  });

    $("#parameter-slot").hide();
  $("#show_parameters").click(function() {
    $("#parameter-slot").toggle();
  });



  // CONTROL PANEL INIT END


  $("#leftjustify button").click(function(event)
                    {
                      var a = event.currentTarget.innerText.split("s");
                      console.log(a[0]);
                      DESIRED_DURATION_S = a[0];
                      console.dir(DESIRED_DURATION_S);
                    });


  $( "#dserverurl" ).val( DSERVER_URL );
  $('#dserverurl').change(function () {
    samples = [];
    DSERVER_URL = $("#dserverurl").val();
    start_interval_timer();
  });

  // This is RespiraWorks specific:
    $('#raworksid').change(function () {
      samples = [];
      RESPIRAWORKS_URL = $("#raworksid").val();
      retrieveAndPlot();
  });


  $( "#traceid" ).val( TRACE_ID );
  $('#traceid').change(function () {
    samples = [];
    TRACE_ID = $("#traceid").val();
    start_interval_timer();
  });


  $( "#samples_to_plot" ).val( MAX_SAMPLES_TO_STORE_S );
  $('#samples_to_plot').change(function () {
    samples = [];
    MAX_SAMPLES_TO_STORE_S = $("#samples_to_plot").val();
    MAX_REFRESH = true;
  });

  samples = init_samples();

  if ($("#clinical_display").is(":checked")) {
    render_samples_clinical(samples);
  } else {
    render_samples_engineering(samples);
  }
  start_interval_timer();

  load_ui_with_defaults(LIMITS);

  set_rise_time_pressures(
    TAIP_AND_TRIP_MIN,
    TAIP_AND_TRIP_MAX,
  );

  function compute_samples_to_match_time(seconds) {
    return seconds * 300;
  }
  function handle_timing_button(event) {
    var id = event.target.id;
    var seconds = id.replace(/[^0-9]/g,'');
    DESIRED_DURATION_S = seconds;
  }
  $("#5s_btn").click(handle_timing_button);
  $("#10s_btn").click(handle_timing_button);
  $("#15s_btn").click(handle_timing_button);
  $("#30s_btn").click(handle_timing_button);
  $("#60s_btn").click(handle_timing_button);
  $("#180s_btn").click(handle_timing_button);
  $("#300s_btn").click(handle_timing_button);



  $("#livetoggle").prop("checked",true);
  $("#clinical_display").prop("checked",false);
  $("#clinical_display").change(change_clinical);

console.dir("SEVENINCHEL14TS",SEVENINCHEL14TS);


  // We need to get the id out of this, which for a general
  // purpose mouse click can be a problem. However, I believe
  // we can search the "e.path" array, which will always have
  // "observable-x#id" in it, from which we can extract the id,
  // in order to know what values to set on the return.
  // We need this to get an id in the "LIMITS" arrange for
  // us to know what to set. I can think of no other way than
  // to do a reverse map; with the idea, we can a verison
  // of "keypress to this function" which will set the value.
  // NOTE: But I now believe this can all be done better by designing
  // the features in HTML and then "showing" only the one we want,
  // which will let us use an id more reasonably.
  function add_high_low_input_to_sidebar(e) {

    console.log("id:",e.currentTarget.host.id);
    const id = e.currentTarget.host.id;
//    const limit_key = lookup_limit_key_by_element_id(id);
    openLeftHandModal(id);

  }
//let template = document.getElementById('observablex');
//let templateContent = template.content;
//document.body.appendChild(templateContent);

  let customElements = window.customElements;

customElements.define('observable-x',
  class extends HTMLElement {
    constructor() {
      super();
      let template = document.getElementById('observable-xx');
      let templateContent = template.content;

      const shadowRoot = this.attachShadow({mode: 'open'})
        .appendChild(templateContent.cloneNode(true));
    }
    connectedCallback(){
      this.shadowRoot.addEventListener("click", function (e) {
        console.log('listend to check event');
        console.log(e);
        // What we really want to do here is to fill the sidebar
        // with effectively a dismissible modal which gets the
        // high and low values. This pretty much has to be
        // appended to the "#leftsidebar" element, in the dom,
        // because we must be free to place other things there.
        // Some how we have to use our identity from e!
        add_high_low_input_to_sidebar(e);
      });
    }
  }
                     );

  function elementIdToLIMITSKey(id) {
    switch (id) {
    case "pipmax":
      return "max";
    case "pipavg":
      return "avg";
    case "pipmin":
      return "min";
    case "mv":
      return "mv";
    case "bpm":
      return "bpm";
    case "inhalationtoexhalation":
      return "ier";
    case "tidalvolume":
      return "tv";
    case "fioxygen2":
      return "fio2";
    case "timeacheiveip":
      return "taip";
    case "timereleaseinspiratorypressure":
      return "trip";
    case "workofbreathing":
      return "wob";
    default:
      console.error("internal error!");
    }
  }

  function closeLeftHandModalOnReturn(ed) {
    if(ed.which == 13) {
      closeLeftHandModal();
    }
  }
  function closeLeftHandModal() {
    // observable-setter is a template,
    // but controllable-setter is a class
    $("observable-setter").hide();
    $(".controllable-setter").hide();
    $("#leftsidebar").hide();
  }
  function openLeftHandModal(id) {
    // We want to remove anything else which is present
    closeLeftHandModal();
    $("#leftsidebar").show();
    $("#"+ id + "-setter").show();
  }
  function getHighFromObservableSetterShadowRoot(sr) {
    const limits = sr.children[1].children[1];
    const highdiv = limits.children[0];
    const high = highdiv.children[2];
    return high;
  }
  function getLowFromObservableSetterShadowRoot(sr) {
    const limits = sr.children[1].children[1];
    const lowdiv = limits.children[1];
    const low = lowdiv.children[2];
    return low;
  }
  function setLimitFromObservableHigh(id,ed) {
    const jqel = $("#"+id)[0];
    const high = getHighFromObservableSetterShadowRoot(jqel.shadowRoot);
    const setterName = id.split("-")[0];
    console.log("setterName",setterName);
    const key = elementIdToLIMITSKey(setterName);
    LIMITS[key].h = parseInt(high.value);
    $("#" + setterName +" span:nth-child(3)").text(LIMITS[key].h);
  }
  function setLimitFromObservableLow(id,ed) {
    const jqel = $("#"+id)[0];
    const low = getLowFromObservableSetterShadowRoot(jqel.shadowRoot);
    const setterName = id.split("-")[0];
    const key = elementIdToLIMITSKey(setterName);
    LIMITS[key].l = parseInt(low.value);
    $("#" + setterName +" span:nth-child(4)").text(LIMITS[key].l);
  }
customElements.define('observable-setter',
  class extends HTMLElement {
    constructor() {
      super();
      let template = document.getElementById('observable-setter-xx');
      let templateContent = template.content;
      const shadowRoot = this.attachShadow({mode: 'open'})
            .appendChild(templateContent.cloneNode(true));
    }
    connectedCallback(){
      this.shadowRoot.addEventListener("keypress",
                                       closeLeftHandModalOnReturn
                                      );

      const id = this.id;
      console.log(id);
      console.log("sr",this.shadowRoot);
      const limits = this.shadowRoot.children[1].children[1];
      const highdiv = limits.children[0];
      const lowdiv = limits.children[1];
      const high = highdiv.children[2];
      const low = lowdiv.children[2];
      console.log("high",high);
      console.log("low",low);
      high.addEventListener("input", (ed) => setLimitFromObservableHigh(id,ed) );
      low.addEventListener("input", (ed) => setLimitFromObservableLow(id,ed) );
    }
  });

  $("#setting_mode").click(() => openLeftHandModal("mode"));
  $("#setting_pimax").click(() => openLeftHandModal("pimax"));
  $("#setting_TV").click(() => openLeftHandModal("TV"));
  $("#setting_RR").click(() => openLeftHandModal("RR"));
  $("#setting_IE").click(() => openLeftHandModal("IE"));
  $("#setting_PEEP").click(() => openLeftHandModal("PEEP"));

  $("#controllable-mode-dismiss").click(() => {
    const v = $("#controllable-mode").val();
    sendOnePIRCS("M",v);
    $("#setting_mode-value").text(v);
    closeLeftHandModal();
  });
  $("#controllable-pimax-dismiss").click(() => {
    const v = $("#controllable-pimax").val();
    sendOnePIRCS("P",v*10);
    $("#setting_pimax-value").text(v);
    closeLeftHandModal();
  });
  $("#controllable-TV-dismiss").click(() => {
    const v = $("#controllable-TV").val();
    sendOnePIRCS("V",v);
    $("#setting_TV-value").text(v);
    closeLeftHandModal();
  });
  $("#controllable-RR-dismiss").click(() => {
    const v = $("#controllable-RR").val();
    sendOnePIRCS("B",v*10);
    $("#setting_RR-value").text(v);
    closeLeftHandModal();
  });
  $("#controllable-IE-dismiss").click(() => {
    const v = $("#controllable-IE").val();
    sendOnePIRCS("I",v);
    $("#setting_IE-value").text(v);
    closeLeftHandModal();
  });
  $("#controllable-PEEP-dismiss").click(() => {
    const v = $("#controllable-PEEP").val();
    sendOnePIRCS("E",v*10);
    $("#setting_PEEP-value").text(v);
    closeLeftHandModal();
  });

  closeLeftHandModal();
});

function change_clinical() {
  if ($("#clinical_display").is(":checked")) {
    $(".engineering_only").hide();
    $("#calcarea").css('background',CLINICAL_COLORS.sidebar_bg);
    $("#calcarea *").css('color',CLINICAL_COLORS.text_color);
    $(".settings_area").css('background',CLINICAL_COLORS.bg);
    $("#data-area").css('background',CLINICAL_COLORS.bg);
    $("#collapsingleftsidebar").css('background',CLINICAL_COLORS.sidebar_bg);
    $("#leftsidebar").css('color',CLINICAL_COLORS.text_color);
  } else {
    $(".engineering_only").show();
    $("#calcarea").css('background',ENGINEERING_COLORS.sidebar_bg);
    $("#calcarea *").css('background',ENGINEERING_COLORS.sidebar_bg);
    $("#calcarea *").css('color',ENGINEERING_COLORS.text_color);

    $(".settings_area").css('background',ENGINEERING_COLORS.bg);
    $("#data-area").css('background',ENGINEERING_COLORS.bg);


  }
}
