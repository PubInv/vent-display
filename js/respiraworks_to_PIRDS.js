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


function respiraworks_to_PIRDS(ra) {
  var converted = ra.scenario.trace_variable_names;
  var traces = ra.traces;
  return { vars: converted, traces: traces };
}
