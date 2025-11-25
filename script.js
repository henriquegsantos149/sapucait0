// Inicialização do Mapa
// Coordenadas iniciais focadas no Rio de Janeiro (serão ajustadas pelo fitBounds depois)
const map = L.map('map', {
    zoomControl: false, // Vamos adicionar manualmente em outra posição
    maxZoom: 25
}).setView([-22.91216, -43.1966], 15);

// Adicionar controle de zoom no canto INFERIOR DIREITO (melhor para mobile)
L.control.zoom({
    position: 'bottomright'
}).addTo(map);

// --- Global Zoom to Layer Function ---
window.zoomToLayer = function (layerId) {
    if (layerId === 'osm') {
        map.setView([-22.91216, -43.1966], 15);
        return;
    }

    // Acessar camadas globais (definidas em initMapData)
    if (window.layers && window.layers[layerId]) {
        const layer = window.layers[layerId];
        if (layer.getBounds) {
            map.fitBounds(layer.getBounds(), { padding: [50, 50] });
        } else if (layer.getLatLng) {
            map.setView(layer.getLatLng(), 18);
        }
    }
};

// --- Custom Control: Locate Me ---
L.Control.Locate = L.Control.extend({
    onAdd: function (map) {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-locate-pill');
        const button = L.DomUtil.create('a', '', container);
        button.innerHTML = '<span>📍 Ativar minha localização</span>';
        button.href = '#';
        button.title = "Onde estou?";
        button.role = "button";

        L.DomEvent.on(button, 'click', function (e) {
            L.DomEvent.stop(e);
            // Inicia o rastreamento com alta precisão
            map.locate({ setView: true, maxZoom: 18, watch: true, enableHighAccuracy: true });
        });

        return container;
    },
    onRemove: function (map) { }
});

L.control.locate = function (opts) {
    return new L.Control.Locate(opts);
}

L.control.locate({ position: 'bottomright' }).addTo(map);

// --- Geolocation Logic ---
let userMarker, userCircle;

function onLocationFound(e) {
    const radius = e.accuracy / 2;

    // Se já existe marcador, atualiza a posição
    if (userMarker) {
        userMarker.setLatLng(e.latlng).bindPopup("Você está aqui (precisão: " + Math.round(radius) + "m)").openPopup();
        userCircle.setLatLng(e.latlng).setRadius(radius);
    } else {
        // Cria novo marcador e círculo
        userMarker = L.marker(e.latlng).addTo(map)
            .bindPopup("Você está aqui (precisão: " + Math.round(radius) + "m)").openPopup();
        userCircle = L.circle(e.latlng, radius).addTo(map);
    }
}

function onLocationError(e) {
    alert("Não foi possível obter sua localização: " + e.message);
}

map.on('locationfound', onLocationFound);
map.on('locationerror', onLocationError);

// 1. Mapa Base (OpenStreetMap)
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 25, // Permite ir até o nível 22
    maxNativeZoom: 19, // Tiles do OSM vão até 19, depois disso o Leaflet faz "overzoom" (estica a imagem)
    minZoom: 10, // Restringe zoom para não sair muito da cidade
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Grupos de Camadas para o Controle
const overlays = {};
const featureGroup = L.featureGroup(); // Para calcular o zoom automático (fitBounds)

// Função auxiliar para carregar GeoJSON
async function loadGeoJSON(url, styleOptions, popupText, layerName) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erro ao carregar ${url}`);
        const data = await response.json();

        const layer = L.geoJSON(data, {
            style: styleOptions,
            onEachFeature: function (feature, layer) {
                if (popupText) {
                    layer.bindPopup(popupText);
                }
            }
        });

        // Adicionar ao mapa, ao grupo de controle e ao featureGroup geral
        layer.addTo(map);
        overlays[layerName] = layer;
        featureGroup.addLayer(layer);

        // Atualizar o controle de camadas e o zoom apenas após carregar tudo
        // (Isso é uma simplificação, idealmente usaríamos Promise.all)
        updateMapBounds();

    } catch (error) {
        console.error('Erro:', error);
    }
}

// Controle de Camadas (Layer Control)
// Inicialmente vazio, será populado dinamicamente ou recriado
// Agora com collapsed: false para ficar sempre aberto
let layerControl = L.control.layers(
    { "Mapa Base": osmLayer },
    overlays,
    { collapsed: false }
).addTo(map);

// Adicionar Escala no canto inferior direito
L.control.scale({
    position: 'bottomright',
    imperial: false // Mostrar apenas métrico (m/km) se preferir, ou true para milhas também
}).addTo(map);

// Função para atualizar bounds e controle
// Nota: Como os fetchs são assíncronos, o controle pode precisar ser atualizado.
// Uma abordagem mais robusta é usar Promise.all. Vamos refatorar para isso.

async function initMapData() {

    // Definições de Estilo
    const styleUber = { color: 'black', weight: 4, opacity: 0.8 };
    const styleMetro = { color: '#FF4500', weight: 4, opacity: 0.8 }; // Laranja avermelhado
    const styleCamarote = { color: 'purple', fillColor: 'purple', fillOpacity: 0.5, weight: 2 };

    try {
        // Carregar todos os dados em paralelo
        const [uberRes, metroRes, camaroteRes] = await Promise.all([
            fetch('data/rota_uber.geojson'),
            fetch('data/rota_metro.geojson'),
            fetch('data/camarote_exemplo.geojson')
        ]);

        const uberData = await uberRes.json();
        const metroData = await metroRes.json();
        const camaroteData = await camaroteRes.json();

        // Criar Layers
        const uberLayer = L.geoJSON(uberData, { style: styleUber }).bindPopup("Caminho Uber");
        const metroLayer = L.geoJSON(metroData, { style: styleMetro }).bindPopup("Caminho do Metrô");
        const camaroteLayer = L.geoJSON(camaroteData, { style: styleCamarote }).bindPopup("Camarote VIP");

        // Adicionar ao mapa
        uberLayer.addTo(map);
        metroLayer.addTo(map);
        camaroteLayer.addTo(map);

        // Adicionar ao FeatureGroup para Zoom
        featureGroup.addLayer(uberLayer);
        featureGroup.addLayer(metroLayer);
        featureGroup.addLayer(camaroteLayer);

        // Ajustar Zoom
        map.fitBounds(featureGroup.getBounds(), { padding: [50, 50] });

        // Atualizar Controle de Camadas
        // Removemos o anterior e criamos um novo com os dados carregados
        // Usamos HTML nas chaves para criar a legenda
        map.removeControl(layerControl);

        // Store layers globally for zoom function
        window.layers = {
            'uber': uberLayer,
            'metro': metroLayer,
            'camarote': camaroteLayer,
            'planta': camaroteOverlay,
            'osm': osmLayer
        };

        // Helper to create label with zoom button
        const createLabel = (text, layerId) => {
            return `<div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                        <span>${text}</span>
                        <button class="zoom-to-layer-btn" onclick="zoomToLayer('${layerId}')" title="Zoom na camada">🔍</button>
                    </div>`;
        };

        const labelUber = createLabel('<span style="color:black; font-weight:bold; font-size:18px;">&#9473;&#9473;</span> Rota Uber', 'uber');
        const labelMetro = createLabel('<span style="color:#FF4500; font-weight:bold; font-size:18px;">&#9473;&#9473;</span> Rota Metrô', 'metro');
        const labelCamarote = createLabel('<span style="display:inline-block; width:12px; height:12px; background:purple; opacity:0.5; border:1px solid purple; margin-right:5px;"></span> Camarote VIP', 'camarote');
        const labelPlanta = createLabel('<span style="font-size:16px;">🗺️</span> Planta Baixa', 'planta');

        layerControl = L.control.layers(
            { "🌍 Mapa Base": osmLayer },
            {
                [labelUber]: uberLayer,
                [labelMetro]: metroLayer,
                [labelCamarote]: camaroteLayer
            },
            { collapsed: false } // Sempre aberto
        ).addTo(map);

        // Add Header with Minimize Button
        const container = layerControl.getContainer();
        const header = L.DomUtil.create('div', 'layer-control-header', container);
        header.innerHTML = '<span>Camadas</span> <button>▼</button>';
        container.insertBefore(header, container.firstChild);

        // Prevent map click propagation
        L.DomEvent.disableClickPropagation(container);

        header.onclick = function (e) {
            L.DomEvent.stop(e);
            if (container.classList.contains('minimized')) {
                container.classList.remove('minimized');
                header.querySelector('button').innerHTML = '▼';
            } else {
                container.classList.add('minimized');
                header.querySelector('button').innerHTML = '▲';
            }
        };

        // 4. Planta Baixa (ImageOverlay)
        // Limites calculados a partir do arquivo .pgw e dimensões da imagem (1938x2113)
        // South-West: [-22.911128, -43.197312]
        // North-East: [-22.910935, -43.197134]
        const camaroteBounds = [[-22.9111280659, -43.1973117666], [-22.9109347872, -43.1971344953]];

        // NOTA: Usando imagem otimizada (_small.png) para melhor performance
        const camaroteOverlay = L.imageOverlay('data/Sapucai_Exemplo_Planta_Camarote_03_small.png', camaroteBounds, {
            opacity: 1,
            interactive: true,
            zIndex: 1
        }); // REMOVIDO .addTo(map) para não carregar de início se não precisar

        // Adicionar ao controle de camadas (mas sem adicionar ao mapa ainda)
        layerControl.addOverlay(camaroteOverlay, labelPlanta);

        // 5. Controle de Visibilidade por Zoom
        // Regra: < 22 mostra GeoJSON, >= 22 mostra PNG
        function updateLayerVisibility() {
            const zoom = map.getZoom();

            if (zoom >= 22) {
                // Mostrar PNG, Esconder GeoJSON
                if (map.hasLayer(camaroteLayer)) {
                    map.removeLayer(camaroteLayer);
                }
                if (!map.hasLayer(camaroteOverlay)) {
                    map.addLayer(camaroteOverlay);
                }
            } else {
                // Mostrar GeoJSON, Esconder PNG
                if (map.hasLayer(camaroteOverlay)) {
                    map.removeLayer(camaroteOverlay);
                }
                // Só adiciona o GeoJSON se ele não estiver lá E se a função já tiver carregado ele (que é o caso aqui)
                if (!map.hasLayer(camaroteLayer)) {
                    map.addLayer(camaroteLayer);
                }
            }
        }

        // Ouvinte de evento de zoom
        map.on('zoomend', updateLayerVisibility);

        // Executar verificação inicial
        updateLayerVisibility();

    } catch (error) {
        console.error("Erro ao carregar dados GeoJSON:", error);
        alert("Erro ao carregar dados do mapa. Verifique o console.");
    }
}

// Iniciar carregamento
initMapData();
