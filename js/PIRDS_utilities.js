// import $ from 'jquery';


// Note: samples is a global here
var MAX_SAMPLES_TO_STORE_S = 2000;
var MAX_REFRESH = false;
var INITS_ONLY = true;


// const CONVERT_PIRDS_TO_SLM = 1/1000;




function unpack(rows, key) {
    return rows.map(function(row) { return row[key]; });
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

function add_samples(samples,cur_sam) {
  if (!cur_sam) return samples;
  cur_sam = sanitize_samples(cur_sam);
  var discard = Math.max(0,
                         samples.length + cur_sam.length - MAX_SAMPLES_TO_STORE_S);
  samples = samples.slice(discard);
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
  return samples;
}


// When used as a module, this is the only function that needs
// to be exported.
// render_samples(max_seconds,pressure_and_flow) takes
// the number of seconds graphed, and the pressure_and_flow arrays
// the error_func typl
// export function getPIRDSData(DSERVER_URL,render_samples,error_func) {
function getPIRDSData(DSERVER_URL,render_samples,error_func) {
  const url = DSERVER_URL + "/"+ MAX_SAMPLES_TO_STORE_S;
  $.ajax({url: url,
          success: function(cur_sam){
            // samples here is a global variable, which is inelegant,
            // but this cannot be done as a pure function
            var tsamples = add_samples(SAMPLES,cur_sam);
            render_samples(tsamples);
          },
          error: function(xhr, ajaxOptions, thrownError) {
	    console.log("Error!" + xhr.status);
	    console.log(thrownError);
            error_func();
          }
         });
}
