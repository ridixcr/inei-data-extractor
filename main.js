'use strict';
var htmlToJson = require('html-to-json');
var fs = require('fs');
var path = require('path');
var XLSX = require('xlsx');
var colors = require('colors');
var argv = require('minimist')(process.argv.slice(2));

var data_input = 'input_data/';
var data_output = 'output_data/';
var root = path.dirname(require.main.filename);
var data_input_dir_path = root + '/' + data_input;
var data_output_dir_path = root + '/' + data_output;
//http://webinei.inei.gob.pe:8080/sisconcode/publico.htm#
function readJSON(p) {
    var contents = fs.readFileSync(p);
    return JSON.parse(contents);
}
String.prototype.replaceAll = function (search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};

function getDataINEI(url, callback) {
    if (url.startsWith('http://webinei.inei.gob.pe:8080')) {
        htmlToJson.request(url, {
            'cp': ['div', function ($div) {
                    return unescape($div.text()).replace(/\s/g, '');
                }]
        }, function (err, result) {
            if (err !== null) {
                callback([]);
            } else {
                callback(result.cp.slice(1));
            }
        });
    } else {
        callback([]);
    }
}

function getCentrosPoblados(dst, callback) {
    getDataINEI(dst.url, (data) => {
        var listCP = [];
        data.forEach((item) => {
            var jsonData = {};//65533 ascci del error de caracter(enie) //241 y 209 (ascci de enie minuscula y mayuscula)            
            jsonData.centro_poblado = item.substring(20, item.indexOf('DEPARTAMENTO:')).replaceAll(String.fromCharCode(65533), String.fromCharCode(209)).toUpperCase();
            jsonData.population = 0;
            jsonData.coordinates = [
                parseFloat(item.substring(item.indexOf('LONGITUD:') + 9, item.indexOf('DISTRITO:'))),
                parseFloat(item.substring(item.indexOf('LATITUD:') + 8, item.indexOf('PROVINCIA:')))
            ];
            dst.distrito = item.substring(item.indexOf('DISTRITO:') + 11, item.indexOf('AREA:')).replaceAll(String.fromCharCode(65533), String.fromCharCode(209)).toUpperCase();
            dst.file = dst.distrito.replace(/\s/g, '').toLowerCase() + '.xls';
            jsonData.tipo_area = item.substring(item.indexOf('AREA:') + 5, item.length);
            listCP.push(jsonData);
        });
        dst.centros_poblados = listCP;
        dst.poblacion_centros_poblados = [];
        callback(dst);
    });
}

function subArrayPopulation(data, idx) {
    var poblacion_cp = [];
    for (var i = idx; i < idx + 20; i++) {
        var item = data[i];
        if (item.__EMPTY_1 && !item.__EMPTY_1.startsWith('Casos') && !item.__EMPTY_1.startsWith('Dpto.') && !item.__EMPTY.trim().startsWith('Total')) {
            poblacion_cp.push({
                rango: item.__EMPTY,
                poblacion: parseInt(item.__EMPTY_1)
            });
        }
    }
    return poblacion_cp;
}

function getPoblacionCentrosPoblados(rfp, callback) {
    if (fs.existsSync(rfp._path)) {
        var workbook = XLSX.readFile(rfp._path);
        var sheet_name_list = workbook.SheetNames;
        var xlData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
        var data = xlData.slice(6);
        var cp = [];
        for (var i = 0; i < data.length; i++) {
            var item = data[i];

            if (item.__EMPTY_1 && item.__EMPTY_1.startsWith('Dpto.')) {
                var idx = item.__EMPTY_1.indexOf('Ccpp');
                idx = idx < 0 ? item.__EMPTY_1.indexOf('Poblaci') : idx;
                cp.push({
                    centro_poblado: item.__EMPTY_1.substring(idx, item.__EMPTY_1.length),
                    population: subArrayPopulation(data, i + 2)
                });
            }
            if (item.__EMPTY && item.__EMPTY.startsWith('RESUMEN')) {
                break;
            }
        }
        rfp.poblacion_centros_poblados = cp;
    }
    callback(rfp);
}
function ensureDirectory(dir) {
    if (!fs.existsSync(dir)) {//fs.lstatSync(dir).isDirectory()
        fs.mkdirSync(dir);
    }
}
function calPop(pop) {
    var s = 0;
    pop.forEach(item => {
        s += item.poblacion;
    });
    return s;
}

function formatCod(c) {
    return (c > 9) ? '' + c : '0' + c;
}

var departamentos = {
    amazonas: {codigo: '01', nombre: 'Amazonas', nro_provincias: 7},
    ancash: {codigo: '02', nombre: 'Áncash', nro_provincias: 20},
    apurimac: {codigo: '03', nombre: 'Apurímac', nro_provincias: 7},
    arequipa: {codigo: '04', nombre: 'Arequipa', nro_provincias: 8},
    ayacucho: {codigo: '05', nombre: 'Ayacucho', nro_provincias: 11,
        provincias: [
            {nombre: 'Huamanga', nro_distritos: 16, distritos: []},
            {nombre: 'Cangallo', nro_distritos: 6, distritos: []},
            {nombre: 'Huanca Sancos', nro_distritos: 4, distritos: []},
            {nombre: 'Huanta', nro_distritos: 8, distritos: []},
            {nombre: 'La Mar', nro_distritos: 9, distritos: []},
            {nombre: 'Lucanas', nro_distritos: 21, distritos: []},
            {nombre: 'Parinacochas', nro_distritos: 8, distritos: []},
            {nombre: 'Paucar de Sara Sara', nro_distritos: 10, distritos: []},
            {nombre: 'Sucre', nro_distritos: 11, distritos: []},
            {nombre: 'Victor Fajardo', nro_distritos: 12, distritos: []},
            {nombre: 'Vilcas Huaman', nro_distritos: 8, distritos: []}
        ]},
    cajamarca: {codigo: '06', nombre: 'Cajamarca', nro_provincias: 13},
    callao: {codigo: '07', nombre: 'Callao', nro_provincias: 1},
    cusco: {codigo: '08', nombre: 'Cusco', nro_provincias: 13},
    huancavelica: {codigo: '09', nombre: 'Huancavelica', nro_provincias: 7},
    huanuco: {codigo: '10', nombre: 'Huánuco', nro_provincias: 11},
    ica: {codigo: '11', nombre: 'Ica', nro_provincias: 5},
    junin: {codigo: '12', nombre: 'Junín', nro_provincias: 9},
    lalibertad: {codigo: '13', nombre: 'La Libertad', nro_provincias: 12},
    lambayeque: {codigo: '14', nombre: 'Lambayeque', nro_provincias: 3},
    lima: {codigo: '15', nombre: 'Lima', nro_provincias: 10},
    loreto: {codigo: '16', nombre: 'Loreto', nro_provincias: 7},
    madrededios: {codigo: '17', nombre: 'Madre de Dios', nro_provincias: 3},
    moquegua: {codigo: '18', nombre: 'Moquegua', nro_provincias: 3},
    pasco: {codigo: '19', nombre: 'Pasco', nro_provincias: 3},
    piura: {codigo: '20', nombre: 'Piura', nro_provincias: 8},
    puno: {codigo: '21', nombre: 'Puno', nro_provincias: 13},
    sanmartin: {codigo: '22', nombre: 'San Martín', nro_provincias: 10},
    tacna: {codigo: '23', nombre: 'Tacna', nro_provincias: 4},
    tumbes: {codigo: '24', nombre: 'Tumbes', nro_provincias: 3},
    ucayali: {codigo: '25', nombre: 'Ucayali', nro_provincias: 4}
};

var convertHTML2JSON_INEIData = function () {
    console.log('Convirtiendo '+'(HTML)'.cyan+' -> '.red+'(JSON)'.yellow+' obteniendo datos de la INEI '+'(1/3)'.green);
    var url_base = 'http://webinei.inei.gob.pe:8080/sisconcode/ubigeo/listaBusquedaCentroPobladoPorUbicacionGeografica.htm?&nivel=4&version=1-1-2&strVersion=2010%20-%201&codPob=&medio=';

    departamentos['ayacucho'].provincias.forEach((item, index) => {
        var provincia_template = {distritos: []};
        for (var i = 0; i < item.nro_distritos; i++) {
            var pi = {url: (url_base + '&ccdd=' + departamentos['ayacucho'].codigo + '&ccpp=' + formatCod(index + 1) + '&ccdi=' + formatCod(i + 1)), distrito: '', centros_poblados: []};
            getCentrosPoblados(pi, (dataf) => {
                pi = dataf;
                if (item.nombre.startsWith('Huamanga') && pi.url.endsWith('04')) {//Carmen Alto
                    pi.distrito = 'Carmen Alto';
                    pi.file = pi.distrito.replace(/\s/g, '').toLowerCase() + '.xls';
                    pi.centros_poblados = [{
                            centro_poblado: 'CARMENALTO',
                            population: 21350,
                            coordinates: [//log,lat
                                -74.2237,
                                -13.1739
                            ],
                            tipo_area: 'Urbano'
                        }];
                    pi.poblacion_centros_poblados = [];
                }
                if (item.nombre.startsWith('Huamanga') && pi.url.endsWith('16')) {//Andres Avelino Caceres Dorregaray
                    pi.distrito = 'Andres Avelino Caceres Dorregaray';
                    pi.file = pi.distrito.replace(/\s/g, '').toLowerCase() + '.xls';
                    pi.centros_poblados = [{
                            centro_poblado: 'ANDRESAVELINOCACERESDORREGARAY',
                            population: 21585,
                            coordinates: [//log,lat
                                -74.2134,
                                -13.1624
                            ],
                            tipo_area: 'Urbano'
                        }];
                    pi.poblacion_centros_poblados = [];
                }
                provincia_template.distritos.push(pi);
                var _dir = data_output_dir_path + 'centro_poblado/';
                ensureDirectory(_dir);
                var _path = _dir + item.nombre.replace(/\s/g, '').toLowerCase() + '_centros_poblados.json';
                fs.writeFileSync(_path, JSON.stringify(provincia_template, null, '\t'));
            });
        }
    });
    console.log('Proceso completado! '.green+':)'.cyan);
};

var convertXLS2JSON_INEIData = function () {
    console.log('Convirtiendo '+'(XLS)'.green+' -> '.red+'(JSON)'.yellow+' obteniendo datos de la INEI '+'(2/3)'.green);
    departamentos['ayacucho'].provincias.forEach(item => {
        var provincia_template = {provincia: '', distritos: []};
        var path_jsonCP = item.nombre.replace(/\s/g, '').toLowerCase() + '_centros_poblados.json';
        var _path = data_input_dir_path + departamentos['ayacucho'].nombre.replace(/\s/g, '').toLowerCase() + '/' + item.nombre.replace(/\s/g, '').toLowerCase();
        var _dir = data_output_dir_path + 'centro_poblado/';
        ensureDirectory(_dir);
        var jsonCP = readJSON(_dir + path_jsonCP);
        provincia_template.provincia = item.nombre;
        jsonCP.distritos.forEach(ditem => {
            ditem._path = _path + '/' + ditem.file;
            getPoblacionCentrosPoblados(ditem, (dataf) => {
                ditem = dataf;
                provincia_template.distritos.push(ditem);
                _dir = data_output_dir_path + 'poblacion_centro_poblado/';
                ensureDirectory(_dir);
                fs.writeFileSync(_dir + item.nombre.replace(/\s/g, '').toLowerCase() + '_poblacion_centros_poblados.json', JSON.stringify(provincia_template, null, '\t'));
            });
        });
    });
    console.log('Proceso completado! '.green+':)'.cyan);
};

var summaryPopulationINEI = function () {
    console.log('Consolidando '+'(JSON)'.yellow+' -> '.red+'(GEOJSON) '.magenta+'(3/3)'.green);
    var poblacion_ram = {
        type: 'FeatureCollection',
        generator: 'inei-data-extractor',
        features: []
    };
    departamentos['ayacucho'].provincias.forEach(item => {
        var _dir = data_output_dir_path + 'poblacion_centro_poblado/';
        ensureDirectory(_dir);
        var _path = _dir + item.nombre.replace(/\s/g, '').toLowerCase() + '_poblacion_centros_poblados.json';
        var jsonCP = readJSON(_path);
        jsonCP.distritos.forEach(ditem => {
            ditem.centros_poblados.forEach(cpitem => {
                var encontrado = false;
                ditem.poblacion_centros_poblados.forEach(pcpitem => {
                    var idx = pcpitem.centro_poblado.indexOf('Ccpp Rur.');
                    idx = idx < 0 ? pcpitem.centro_poblado.indexOf('Ccpp Urb.') : idx;
                    var cp_name = pcpitem.centro_poblado.substring(idx + 9, pcpitem.centro_poblado.length).trim();
                    var str_cnt = cpitem.centro_poblado.replace(/\s/g, '').toLowerCase().startsWith(cp_name.replace(/\s/g, '').toLowerCase());
                    if (str_cnt) {
                        poblacion_ram.features.push({
                            type: 'Feature',
                            properties: {
                                population: calPop(pcpitem.population),
                                province: jsonCP.provincia,
                                district: ditem.distrito,
                                name: cp_name,
                                place: 'village',
                                "marker-color": "#0489bf",
                                "marker-size": "medium",
                                "marker-symbol": "village"
                            },
                            geometry: {
                                type: 'Point',
                                coordinates: cpitem.coordinates
                            }
                        });
                        encontrado = true;
                    }
                });
                if (!encontrado) {
                    poblacion_ram.features.push({
                        type: 'Feature',
                        properties: {
                            population: cpitem.population,
                            province: jsonCP.provincia,
                            district: ditem.distrito,
                            name: cpitem.centro_poblado,
                            place: 'village',
                            "marker-color": "#fd0000",
                            "marker-size": "medium",
                            "marker-symbol": "village"
                        },
                        geometry: {
                            type: 'Point',
                            coordinates: cpitem.coordinates
                        }
                    });
                }
                fs.writeFileSync(data_output_dir_path + '/' + departamentos['ayacucho'].nombre.replace(/\s/g, '').toLowerCase() + '_ram_population.geojson', JSON.stringify(poblacion_ram, null, '\t'));
            });
        });
    });
    console.log('Proceso completado! '.green+':)'.cyan);
    console.log('Archivo consolidado ubicado en : '+'output_data/'.yellow+'ayacucho_ram_population.geojson'.green);
};

if (argv._.length>0) {
    console.log(argv._[0]);
    if(argv._[0].startsWith('html2json')){convertHTML2JSON_INEIData();}
    if(argv._[0].startsWith('xls2json')){convertXLS2JSON_INEIData();}
    if(argv._[0].startsWith('json2geojson')){summaryPopulationINEI();}
}else{ 
    console.log('Without parameters:'.cyan); 
    console.log('Usually '.cyan+'node main.js <html2json|xls2json|json2geojson>'.yellow);
}