var L;
(function (L) {
    let Handler;
    (function (Handler) {
        class SelectBox extends L.Handler {
            initialize(map) {
                this._map = map;
                this._container = map.getContainer();
                this._pane = map.getPane("overlayPane");
                this._resetStateTimeout = 0;
                map.on('unload', this._destroy, this);
            }
            addHooks() {
                this._map.on('selectbox:end', this._onSelectBoxEnd, this);
                this._map.on('selectbox:copyall', this._onCopySelected, this);
                this._map.on('selectbox:deleteall', this._onDeleteSelected, this);
                L.DomEvent.on(this._container, 'mousedown', this._onMouseDown, this);
            }
            removeHooks() {
                this._map.off('selectbox:end', this._onSelectBoxEnd, this);
                this._map.off('selectbox:copyall', this._onCopySelected, this);
                this._map.off('selectbox:deleteall', this._onDeleteSelected, this);
                L.DomEvent.off(this._container, 'mousedown', this._onMouseDown, this);
            }
            moved() {
                return this._moved;
            }
            _destroy() {
                L.DomUtil.remove(this._pane);
                delete this._pane;
            }
            _resetState() {
                this._resetStateTimeout = 0;
                this._moved = false;
            }
            _clearDeferredResetState() {
                if (this._resetStateTimeout !== 0) {
                    clearTimeout(this._resetStateTimeout);
                    this._resetStateTimeout = 0;
                }
            }
            _onMouseDown(e) {
                if (!e.ctrlKey || ((e.which !== 1) && (e.button !== 1))) {
                    return;
                }
                this._clearDeferredResetState();
                this._resetState();
                L.DomUtil.disableTextSelection();
                L.DomUtil.disableImageDrag();
                this._map.dragging.disable();
                this._startPoint = this._map.mouseEventToContainerPoint(e);
                if (this._selectionRectangle) {
                    this._map.removeLayer(this._selectionRectangle);
                    delete this._selectionRectangle;
                }
                L.DomEvent.on(document, {
                    contextmenu: L.DomEvent.stop,
                    mousemove: this._onMouseMove,
                    mouseup: this._onMouseUp,
                    keydown: this._onKeyDown
                }, this);
                if (this._selectedObjects && this._selectedObjects.length > 0) {
                    for (let i = 0; i < this._selectedObjects.length > 0; i++) {
                        const l = this._selectedObjects[i];
                        if (l._icon)
                            L.DomUtil.removeClass(l._icon, 'leaflet-userobject-selected');
                        else if (l._path)
                            L.DomUtil.removeClass(l._path, 'leaflet-userobject-selected');
                    }
                    this._selectedObjects = [];
                }
            }
            _onMouseMove(e) {
                if (!this._moved) {
                    this._moved = true;
                    this._box = L.DomUtil.create('div', 'leaflet-select-box', this._container);
                    L.DomUtil.addClass(this._container, 'leaflet-crosshair');
                    this._map.fire('selectbox:start');
                }
                this._point = this._map.mouseEventToContainerPoint(e);
                var bounds = new L.Bounds(this._point, this._startPoint), size = bounds.getSize();
                L.DomUtil.setPosition(this._box, bounds.min);
                this._box.style.width = size.x + 'px';
                this._box.style.height = size.y + 'px';
            }
            _finish() {
                if (this._moved) {
                    L.DomUtil.remove(this._box);
                    L.DomUtil.removeClass(this._container, 'leaflet-crosshair');
                }
                L.DomUtil.enableTextSelection();
                L.DomUtil.enableImageDrag();
                L.DomEvent.off(document, {
                    contextmenu: L.DomEvent.stop,
                    mousemove: this._onMouseMove,
                    mouseup: this._onMouseUp,
                    keydown: this._onKeyDown
                }, this);
            }
            _onMouseUp(e) {
                if ((e.which !== 1) && (e.button !== 1)) {
                    return;
                }
                this._finish();
                if (!this._moved) {
                    return;
                }
                this._clearDeferredResetState();
                this._resetStateTimeout = setTimeout(L.Util.bind(this._resetState, this), 0);
                this._map.dragging.enable();
                var bounds = new L.LatLngBounds(this._map.containerPointToLatLng(this._startPoint), this._map.containerPointToLatLng(this._point));
                this._map.fire('selectbox:end', { selectBounds: bounds });
            }
            _onSelectBoxEnd(e) {
                if (!this._selectedObjects)
                    this._selectedObjects = [];
                let east = -180.0;
                let north = -85;
                let west = 180.0;
                let south = 85;
                this._map.eachLayer(l => {
                    if (!l.typeOf || this._selectedObjects.find(o => l._leaflet_id === o._leaflet_id))
                        return;
                    if (l._icon && l._icon.className && (l._icon.className.indexOf('-vertex-icon') > -1 || l._icon.className.indexOf('-middle-icon') > -1))
                        return;
                    if (e.selectBounds.contains(l._latlngs || l._latlng)) {
                        if (l.getBounds) {
                            const layerBounds = l.getBounds();
                            west = Math.min(layerBounds.getWest(), west);
                            south = Math.min(layerBounds.getSouth(), south);
                            east = Math.max(layerBounds.getEast(), east);
                            north = Math.max(layerBounds.getNorth(), north);
                        }
                        else if (l._latlng) {
                            west = Math.min(l._latlng.lng, west);
                            south = Math.min(l._latlng.lat, south);
                            east = Math.max(l._latlng.lng, east);
                            north = Math.max(l._latlng.lat, north);
                        }
                        this._selectedObjects.push(l);
                        if (l._icon)
                            L.DomUtil.addClass(l._icon, 'leaflet-userobject-selected');
                        else if (l._path)
                            L.DomUtil.addClass(l._path, 'leaflet-userobject-selected');
                    }
                });
                if (this._selectedObjects && this._selectedObjects.length > 0) {
                    L.DomEvent.on(document, 'keydown', this._onKeyDownWhenObjectsSelected, this);
                    let selectRectangle = L.gisRectangle(L.latLngBounds(L.latLng(north, west), L.latLng(south, east)), {
                        fill: '#fff',
                        fillOpacity: 0.1,
                        weight: 1,
                        dashArray: '3 3',
                        contextmenu: true,
                        contextmenuInheritItems: false,
                        contextmenuItems: [
                            {
                                text: "Копировать объекты",
                                context: this,
                                callback(showLocation) {
                                    this._map.fire('selectbox:copyall');
                                }
                            },
                            '-',
                            {
                                text: "Удалить объекты",
                                context: this,
                                callback(showLocation) {
                                    this._map.fire('selectbox:deleteall');
                                }
                            }
                        ]
                    });
                    this._selectionRectangle = selectRectangle.addTo(this._map);
                }
            }
            _onKeyDown(e) {
                if (e.keyCode === 27) {
                    this._finish();
                }
            }
            _onDeleteSelected(e) {
                if (e && e.selectedObject && !this._selectedObjects.find(f => f === e.selectedObject))
                    return;
                for (let i = 0; i < this._selectedObjects.length; i++) {
                    this._map.removeLayer(this._selectedObjects[i]);
                    this._map.editTools.featuresLayer.removeLayer(this._selectedObjects[i]);
                    this._map.fire(`${this._selectedObjects[i].typeOf}supdated`);
                }
                this._map.layerControl.saveAllUserObjects();
                L.DomEvent.off(document, 'keydown', this._onKeyDownWhenObjectsSelected, this);
                this._map.removeLayer(this._selectionRectangle);
                this._map.fire('gis:notify', { message: `Удалено объектов: ${this._selectedObjects.length}` });
                delete this._selectionRectangle;
                delete this._selectedObjects;
            }
            _onCopySelected() {
                const geoJsonArray = [];
                for (let i = 0; i < this._selectedObjects.length; i++) {
                    geoJsonArray.push(this._selectedObjects[i].toStyledGeoJSON());
                }
                Gis.Clipboard.copyTextToClipboard(JSON.stringify(geoJsonArray));
                this._map.fire('gis:notify', { message: `Cкопировано объектов: ${geoJsonArray.length}` });
            }
            _onDeselect() {
                for (let i = 0; i < this._selectedObjects.length; i++) {
                    if (this._selectedObjects[i]._icon) {
                        L.DomUtil.removeClass(this._selectedObjects[i]._icon, 'leaflet-userobject-selected');
                    }
                    else if (this._selectedObjects[i]._path) {
                        L.DomUtil.removeClass(this._selectedObjects[i]._path, 'leaflet-userobject-selected');
                    }
                }
                delete this._selectedObjects;
                L.DomEvent.off(document, 'keydown', this._onKeyDownWhenObjectsSelected, this);
                this._map.off('gis:editable:delete', this._onDeleteSelected);
                this._map.removeLayer(this._selectionRectangle);
                delete this._selectionRectangle;
            }
            _onKeyDownWhenObjectsSelected(e) {
                if (!(this._selectedObjects && this._selectedObjects.length > 0))
                    return;
                if (e.keyCode === 46 || e.keyCode === 8) {
                    this._map.fire('selectbox:deleteall');
                }
                else if ((e.ctrlKey || e.metaKey) && e.keyCode === 67) {
                    this._map.fire('selectbox:copyall');
                }
                else if (e.keyCode === 27) {
                    this._onDeselect();
                }
            }
        }
        Handler.SelectBox = SelectBox;
        ;
    })(Handler = L.Handler || (L.Handler = {}));
    function selectBox(opts) {
        return new L.Handler.SelectBox(opts);
    }
    L.selectBox = selectBox;
})(L || (L = {}));
L.Map.addInitHook('addHandler', 'selectBox', L.selectBox);
