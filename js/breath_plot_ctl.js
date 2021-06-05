
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

const VENTMON_DATA_LAKE = "http://ventmon.coslabs.com";
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
var TRACE_ID = urlParams.get('i')
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
var MAX_SAMPLES_TO_STORE_S = 2000;
var MAX_REFRESH = false;
var samples = [];
var INITS_ONLY = true;

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



function unpack(rows, key) {
    return rows.map(function(row) { return row[key]; });
}

// const CONVERT_PIRDS_TO_SLM = 1/1000;

// we have now changed this, there will be flow and
// pressure in the same samples, and we should filter.
// TODO: I need to add maximal start and end
// samples to equalize all the plots.
function samplesToLine(samples) {
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
		  line: {color: "#FF0000"}
		 };

  var flow = {type: "scatter", mode: "lines",
		name: "flow",
		x: fzeroed,
	      y: flow_values,
              xaxis: 'x2',
              yaxis: 'y2',
              fill: 'tozeroy',
		line: {color: '#0000FF'}
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
function plot(samples, trans, breaths) {
  var new_data = samplesToLine(samples);
  var millis = unpack(samples, 'ms');
  var min = Math.min(...millis);
  var zeroed = millis.map(m =>(m-min)/1000.0);
  var max = Math.max(...millis);
  var total_seconds = (max-min)/1000.0;



//  }

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
      height: SEVENINCHEL14TS ? 400 : null,
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
      height: SEVENINCHEL14TS ? 500 : null,
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


function process(samples) {
  const t = 200; // size of the window is 200ms
  const v = 50; // min volume in ml
  var [transitions,breaths] = computeMovingWindowTrace(samples,t,v);
  plot(samples,transitions,breaths);
  // How many seconds backwards should we look? Perhaps 20?
  var [bpm,tv,mv,EIratio,wob] = compute_respiration_rate(RESPIRATION_RATE_WINDOW_SECONDS,samples,transitions,breaths);

  var alarms = [];

  $("#bpm").text(bpm.toFixed(1));
  $("#tv").text(tv.toFixed(0));
  $("#mv").text(mv.toFixed(2));

  if (wob == "NA") {
    $("#wob").text("NA");
  } else {
    $("#wob").text(wob.toFixed(2));
  }
  if (EIratio == "NA") {
    $("#ier").text("NA");
  } else {
    $("#ier").text((1.0 / EIratio).toFixed(1));
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
    $("#taip").text(taip.toFixed(1));
    alarms = alarms.concat(
      check_high_and_low(LIMITS,"taip",taip,b_ms));
  } else {
    $("#taip").text("NA");
  }

  var trip = compute_mean_TRIP_or_TAIP(
    TAIP_AND_TRIP_MIN,
    TAIP_AND_TRIP_MAX,
    samples,
    false);
  if (trip != "NA") {
    $("#trip").text(trip.toFixed(1));
    alarms = alarms.concat(
      check_high_and_low(LIMITS,"trip",trip,b_ms));
  } else {
    $("#trip").text("NA");
  }

  var [min,avg,max,palarms] = compute_pressures(RESPIRATION_RATE_WINDOW_SECONDS,samples,alarms,LIMITS);
  alarms = alarms.concat(palarms);

  $("#min").text(min.toFixed(1));
  $("#avg").text(avg.toFixed(1));
  $("#max").text(max.toFixed(1));

  var fio2 = compute_fio2_mean(RESPIRATION_RATE_WINDOW_SECONDS,samples);

   if(fio2 == null){
    $("#fio2").text("NA");
   } else {
    alarms = alarms.concat(check_high_and_low(LIMITS,"fio2",fio2.toFixed(1),b_ms));
    $("#fio2").text(fio2.toFixed(1));
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
//  console.log("process",start);
//  console.log("process",finish);
}

// WARNING: This is a hack...if the timestamp is negative,
// we treat it as a limited (beyond range of sensor) measurement.
// Our goal is to warn about this, but for now we will just
// ignore and correct.
function sanitize_samples(samples) {
  samples.forEach(s =>
                  {
                    if (s.event == "M") {
                      if ("string" == (typeof s.ms))
                        s.ms = parseInt(s.ms);
                      if ("string" == (typeof s.val))
                        s.val = parseInt(s.val);
                      if ("string" == (typeof s.num))
                        s.num = parseInt(s.num);
                      if (s.ms < 0) {
                        s.ms = -s.ms;
                      } else if (s.event == "E") {
                      }
                    }

                  });
  return samples;
}

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
    url =  DSERVER_URL + trace_piece + "/json?n="+ MAX_SAMPLES_TO_STORE_S;
  } else {
    url = DSERVER_URL + trace_piece + "/json?n="+  NUM_TO_READ +
      "&t=" + encodeURIComponent(LAST_SAMPLE_DATE.toUTCString());
  }

  //
  // Our basic rule is:
  // if we are live and we have samples,
  // we always set z= to the last sample.
  if (!TREAT_LIVE_AND_OVERRIDE_TIME) {
    var REQUEST_FINAL_SAMPLE;
    if (intervalID  && LAST_SAMPLE_DATE) {
      var currentDate = new Date();
      var t = currentDate.getTime();
      var tm = t - DESIRED_DURATION_S*1000;
      var t_max = Math.max(tm,LAST_SAMPLE_DATE.getTime());
      var date_minus_duration = new Date(t_max);
      url = DSERVER_URL + trace_piece + "/json?n="+  NUM_TO_READ +
        "&a=" + encodeURIComponent(date_minus_duration.toUTCString()) +
        "&z=" + encodeURIComponent(currentDate.toUTCString());
      REQUEST_FINAL_SAMPLE = currentDate;
      //    console.log("A",date_minus_duration);
      //    console.log("Z",currentDate);
    } else {
    }
  }
  console.log("url =",decodeURI(url));
  $.ajax({url: url,
          success: function(cur_sam){

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
                cur_sam = sanitize_samples(cur_sam);
	        if (INITS_ONLY) {
	          samples = cur_sam;
	          INITS_ONLY = false;
	        } else {
                  console.log("cursuam: a,z : ",cur_sam[0].ms,cur_sam[cur_sam.length-1].ms);

                  var first_new_ms = cur_sam[0].ms;
//                  var cur_first_ms = samples[0].ms;
                  // THIS IS WRONG
                  // if (first_new_ms < cur_first_ms) { // This means a reset of the Arduino, we will dump samples..
                  //   samples = [];
                  //   console.log("DETECTED ARDUINO RESET, DUMPING CURRENT SAMPLES");
                  // }
                  var discard = Math.max(0,
                                         samples.length + cur_sam.length - MAX_SAMPLES_TO_STORE_S);
	          samples = samples.slice(discard);
	        }

                // This is leading to an inconsistency!!
	        samples = samples.concat(cur_sam);
                samples.sort((a,b) => a.ms < b.ms);
	        // We are not guaranteeed to get samples in order
	        // we sort them....
                // We also need to de-dup them.
                // This would be more efficient if done after sorting..
                var n = samples.length;

                // I think this is de-dupeing code...
                samples = samples.filter((s, index, self) =>
                                         self.findIndex(t => t.ms === s.ms
                                                        && t.type === s.type
                                                        && t.loc === s.loc
                                                        && t.num === s.num
                                                        && t.event === s.event
                                                        && t.val === s.val) === index);
              }

              if (n != samples.length) {
                console.log("deduped:",n-samples.length);
              }

              // Now we will trim off samples if we are live...
              if (intervalID) {
                var last_ms = samples[samples.length-1].ms
                samples = samples.filter((s, index, self) =>
                                         s.ms >= (last_ms - DESIRED_DURATION_S*1000));
              }
//              console.log(samples);
              if (samples.length > 0)
                process(samples);
              console.log("END",LAST_SAMPLE_DATE);
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
          $.ajax({
            //url: lh+"/api/pircs?com=C&par="+parName+"&int="+interp+"&mod="+modifier+"&val="+val,
            type: 'GET',
            url: 'http://localhost:5000/api/pircs/',
            dataType: 'json',
            data: { com: "C", par: k, int: "T", mod: "A", val: dict[k] }
          }).done(function(result) {
            console.log("result: " + JSON.stringify(result));
          }).fail(function(xhr, ajaxOptions, thrownError) {
            console.log("Error! " + xhr.status);
            console.log(thrownError);
          })

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
  process(samples);
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

});

$("#livetoggle").prop("checked",true);

console.dir("SEVENINCHEL14TS",SEVENINCHEL14TS);
