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
                    for (let i = 0; i < this._selectedObjects.length; i++) {
                        const l = this._selectedObjects[i];
                        if (l instanceof L.EditableGisMarker && l._icon)
                            L.DomUtil.removeClass(l._icon, 'leaflet-userobject-selected');
                        else if (l instanceof L.EditableGisCircle || l instanceof L.EditableGisPolygon || l instanceof L.EditableGisPolyline) {
                            if (l._path)
                                L.DomUtil.removeClass(l._path, 'leaflet-userobject-selected');
                        }
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
                const eachLayer = (l) => {
                    if (!l.typeOf || this._selectedObjects.find(o => l._leaflet_id === o._leaflet_id))
                        return;
                    if (e.selectBounds.contains(l._latlngs || l._latlng || (l.getBounds && l.getBounds()))) {
                        if (l instanceof L.Polyline) {
                            const layerBounds = l.getBounds();
                            west = Math.min(layerBounds.getWest(), west);
                            south = Math.min(layerBounds.getSouth(), south);
                            east = Math.max(layerBounds.getEast(), east);
                            north = Math.max(layerBounds.getNorth(), north);
                        }
                        else if (l instanceof L.Marker) {
                            west = Math.min(l.getLatLng().lng, west);
                            south = Math.min(l.getLatLng().lat, south);
                            east = Math.max(l.getLatLng().lng, east);
                            north = Math.max(l.getLatLng().lat, north);
                        }
                        this._selectedObjects.push(l);
                        if (l._icon)
                            L.DomUtil.addClass(l._icon, 'leaflet-userobject-selected');
                        else if (l._path)
                            L.DomUtil.addClass(l._path, 'leaflet-userobject-selected');
                    }
                };
                this._map.editTools.featuresLayer.eachLayer(l => eachLayer(l));
                userGrids.eachLayer(l => {
                    if (l.typeOf === 'grid') {
                        const layerBounds = l.getBounds();
                        if (e.selectBounds.contains(layerBounds)) {
                            west = Math.min(layerBounds.getWest(), west);
                            south = Math.min(layerBounds.getSouth(), south);
                            east = Math.max(layerBounds.getEast(), east);
                            north = Math.max(layerBounds.getNorth(), north);
                            this._selectedObjects.push(l);
                        }
                    }
                    if (l._path)
                        L.DomUtil.addClass(l._path, 'leaflet-userobject-selected');
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
                    userGrids.removeLayer(this._selectedObjects[i]);
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
                    geoJsonArray.push(this._selectedObjects[i].feature);
                }
                Gis.Clipboard.copyTextToClipboard(JSON.stringify(geoJsonArray));
                this._map.fire('gis:notify', { message: `Cкопировано объектов: ${geoJsonArray.length}` });
            }
            _onDeselect() {
                for (let i = 0; i < this._selectedObjects.length; i++) {
                    const drawable = this._selectedObjects[i];
                    if (drawable._icon) {
                        L.DomUtil.removeClass(drawable._icon, 'leaflet-userobject-selected');
                    }
                    else if (drawable._path) {
                        L.DomUtil.removeClass(drawable._path, 'leaflet-userobject-selected');
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
    function selectBox(map) {
        return new L.Handler.SelectBox(map);
    }
    L.selectBox = selectBox;
})(L || (L = {}));
L.Map.addInitHook('addHandler', 'selectBox', L.selectBox);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGVhZmxldC5zZWxlY3Rib3guanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJsZWFmbGV0LnNlbGVjdGJveC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxJQUFVLENBQUMsQ0F3VVY7QUF4VUQsV0FBVSxDQUFDO0lBZVAsSUFBaUIsT0FBTyxDQXFUdkI7SUFyVEQsV0FBaUIsT0FBTztRQUNwQixNQUFhLFNBQVUsU0FBUSxDQUFDLENBQUMsT0FBTztZQVlwQyxVQUFVLENBQUUsR0FBVTtnQkFDbEIsSUFBSSxDQUFDLElBQUksR0FBRyxHQUFHLENBQUM7Z0JBQ2hCLElBQUksQ0FBQyxVQUFVLEdBQUcsR0FBRyxDQUFDLFlBQVksRUFBRSxDQUFDO2dCQUNyQyxJQUFJLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7Z0JBQ3hDLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxDQUFDLENBQUM7Z0JBQzVCLEdBQUcsQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDMUMsQ0FBQztZQUVRLFFBQVE7Z0JBQ2IsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQzFELElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLG1CQUFtQixFQUFFLElBQUksQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQzlELElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLHFCQUFxQixFQUFFLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDbEUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQztZQUN6RSxDQUFDO1lBRVEsV0FBVztnQkFDaEIsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQzNELElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLG1CQUFtQixFQUFFLElBQUksQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQy9ELElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLHFCQUFxQixFQUFFLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDbkUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQztZQUMxRSxDQUFDO1lBRUQsS0FBSztnQkFDRCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7WUFDdkIsQ0FBQztZQUVELFFBQVE7Z0JBQ0osQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUM3QixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUM7WUFDdEIsQ0FBQztZQUVELFdBQVc7Z0JBQ1AsSUFBSSxDQUFDLGtCQUFrQixHQUFHLENBQUMsQ0FBQztnQkFDNUIsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUM7WUFDeEIsQ0FBQztZQUVELHdCQUF3QjtnQkFDcEIsSUFBSSxJQUFJLENBQUMsa0JBQWtCLEtBQUssQ0FBQyxFQUFFO29CQUMvQixZQUFZLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUM7b0JBQ3RDLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxDQUFDLENBQUM7aUJBQy9CO1lBQ0wsQ0FBQztZQUVELFlBQVksQ0FBQyxDQUFhO2dCQUN0QixJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRTtvQkFDckQsT0FBTztpQkFDVjtnQkFJRCxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztnQkFDaEMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO2dCQUVuQixDQUFDLENBQUMsT0FBTyxDQUFDLG9CQUFvQixFQUFFLENBQUM7Z0JBQ2pDLENBQUMsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztnQkFDN0IsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBRTdCLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDM0QsSUFBSSxJQUFJLENBQUMsbUJBQW1CLEVBQUU7b0JBQzFCLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO29CQUNoRCxPQUFPLElBQUksQ0FBQyxtQkFBbUIsQ0FBQztpQkFDbkM7Z0JBRUQsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUNsQjtvQkFDSSxXQUFXLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJO29CQUM1QixTQUFTLEVBQUUsSUFBSSxDQUFDLFlBQVk7b0JBQzVCLE9BQU8sRUFBRSxJQUFJLENBQUMsVUFBVTtvQkFDeEIsT0FBTyxFQUFFLElBQUksQ0FBQyxVQUFVO2lCQUMzQixFQUNELElBQUksQ0FBQyxDQUFDO2dCQUNWLElBQUksSUFBSSxDQUFDLGdCQUFnQixJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO29CQUMzRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTt3QkFDbkQsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUNuQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsaUJBQWlCLElBQUksQ0FBQyxDQUFDLEtBQUs7NEJBQzNDLENBQUMsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsNkJBQTZCLENBQUMsQ0FBQzs2QkFDN0QsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLGlCQUFpQixJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsa0JBQWtCLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxtQkFBbUIsRUFBRTs0QkFDbEgsSUFBSSxDQUFDLENBQUMsS0FBSztnQ0FDUCxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLDZCQUE2QixDQUFDLENBQUM7eUJBQ3JFO3FCQUNKO29CQUNELElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxFQUFFLENBQUM7aUJBQzlCO1lBQ0wsQ0FBQztZQUVELFlBQVksQ0FBQyxDQUFhO2dCQUN0QixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRTtvQkFDZCxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztvQkFFbkIsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsb0JBQW9CLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO29CQUMzRSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLG1CQUFtQixDQUFDLENBQUM7b0JBRXpELElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7aUJBQ3JDO2dCQUVELElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFFdEQsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUNwRCxJQUFJLEdBQUcsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUU1QixDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFFN0MsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO2dCQUN0QyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUM7WUFDM0MsQ0FBQztZQUVELE9BQU87Z0JBQ0gsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO29CQUNiLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDNUIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO2lCQUMvRDtnQkFFRCxDQUFDLENBQUMsT0FBTyxDQUFDLG1CQUFtQixFQUFFLENBQUM7Z0JBQ2hDLENBQUMsQ0FBQyxPQUFPLENBQUMsZUFBZSxFQUFFLENBQUM7Z0JBRTVCLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFDbkI7b0JBQ0ksV0FBVyxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSTtvQkFDNUIsU0FBUyxFQUFFLElBQUksQ0FBQyxZQUFZO29CQUM1QixPQUFPLEVBQUUsSUFBSSxDQUFDLFVBQVU7b0JBQ3hCLE9BQU8sRUFBRSxJQUFJLENBQUMsVUFBVTtpQkFDM0IsRUFDRCxJQUFJLENBQUMsQ0FBQztZQUNkLENBQUM7WUFFRCxVQUFVLENBQUMsQ0FBYTtnQkFDcEIsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxFQUFFO29CQUNyQyxPQUFPO2lCQUNWO2dCQUVELElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFFZixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRTtvQkFDZCxPQUFPO2lCQUNWO2dCQUdELElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO2dCQUNoQyxJQUFJLENBQUMsa0JBQWtCLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBRzdFLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUc1QixJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQzNCLElBQUksQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUNsRCxJQUFJLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO2dCQUVuRCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztZQUM5RCxDQUFDO1lBRUQsZUFBZSxDQUFDLENBQWlCO2dCQUM3QixJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQjtvQkFBRSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsRUFBRSxDQUFDO2dCQUV2RCxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQztnQkFDbEIsSUFBSSxLQUFLLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQ2hCLElBQUksSUFBSSxHQUFHLEtBQUssQ0FBQztnQkFDakIsSUFBSSxLQUFLLEdBQUcsRUFBRSxDQUFDO2dCQUVmLE1BQU0sU0FBUyxHQUFHLENBQUMsQ0FBUSxFQUFFLEVBQUU7b0JBQzNCLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsV0FBVyxLQUFLLENBQUMsQ0FBQyxXQUFXLENBQUM7d0JBQUUsT0FBTztvQkFDMUYsSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLEVBQUU7d0JBRXBGLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxRQUFRLEVBQUU7NEJBQ3pCLE1BQU0sV0FBVyxHQUFHLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQzs0QkFDbEMsSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLE9BQU8sRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDOzRCQUM3QyxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7NEJBQ2hELElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQzs0QkFDN0MsS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO3lCQUNuRDs2QkFDSSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxFQUFFOzRCQUM1QixJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDOzRCQUN6QyxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDOzRCQUMzQyxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDOzRCQUN6QyxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO3lCQUM5Qzt3QkFFRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUU5QixJQUFJLENBQUMsQ0FBQyxLQUFLOzRCQUNQLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsNkJBQTZCLENBQUMsQ0FBQzs2QkFDMUQsSUFBSSxDQUFDLENBQUMsS0FBSzs0QkFDWixDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLDZCQUE2QixDQUFDLENBQUM7cUJBQ2xFO2dCQUNMLENBQUMsQ0FBQTtnQkFFRCxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQy9ELFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUU7b0JBQ3BCLElBQUksQ0FBQyxDQUFDLE1BQU0sS0FBSyxNQUFNLEVBQUU7d0JBQ3JCLE1BQU0sV0FBVyxHQUFHLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQzt3QkFDbEMsSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsRUFBRTs0QkFDdEMsSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLE9BQU8sRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDOzRCQUM3QyxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7NEJBQ2hELElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQzs0QkFDN0MsS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDOzRCQUNoRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO3lCQUNqQztxQkFDSjtvQkFDRCxJQUFJLENBQUMsQ0FBQyxLQUFLO3dCQUNQLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsNkJBQTZCLENBQUMsQ0FBQztnQkFDbkUsQ0FBQyxDQUFDLENBQUM7Z0JBRUgsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7b0JBQzNELENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLDZCQUE2QixFQUFFLElBQUksQ0FBQyxDQUFDO29CQUM3RSxJQUFJLGVBQWUsR0FBRyxDQUFDLENBQUMsWUFBWSxDQUNoQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxFQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQzNEO3dCQUNJLElBQUksRUFBRSxNQUFNO3dCQUNaLFdBQVcsRUFBRSxHQUFHO3dCQUNoQixNQUFNLEVBQUUsQ0FBQzt3QkFDVCxTQUFTLEVBQUUsS0FBSzt3QkFDaEIsV0FBVyxFQUFFLElBQUk7d0JBQ2pCLHVCQUF1QixFQUFFLEtBQUs7d0JBQzlCLGdCQUFnQixFQUFFOzRCQUNkO2dDQUNJLElBQUksRUFBRSxvQkFBb0I7Z0NBQzFCLE9BQU8sRUFBRSxJQUFJO2dDQUNiLFFBQVEsQ0FBRSxZQUFnQztvQ0FDdEMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQztnQ0FDeEMsQ0FBQzs2QkFDSjs0QkFDRCxHQUFHOzRCQUNIO2dDQUNJLElBQUksRUFBRSxpQkFBaUI7Z0NBQ3ZCLE9BQU8sRUFBRSxJQUFJO2dDQUNiLFFBQVEsQ0FBQyxZQUFnQztvQ0FDckMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQztnQ0FDMUMsQ0FBQzs2QkFDSjt5QkFDSjtxQkFDSixDQUFDLENBQUM7b0JBQ1AsSUFBSSxDQUFDLG1CQUFtQixHQUFHLGVBQWUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUMvRDtZQUNMLENBQUM7WUFFRCxVQUFVLENBQUMsQ0FBZ0I7Z0JBQ3ZCLElBQUksQ0FBQyxDQUFDLE9BQU8sS0FBSyxFQUFFLEVBQUU7b0JBQ2xCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztpQkFDbEI7WUFDTCxDQUFDO1lBRUQsaUJBQWlCLENBQUMsQ0FBTTtnQkFDcEIsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLGNBQWMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLGNBQWMsQ0FBQztvQkFBRSxPQUFPO2dCQUM5RixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtvQkFDbkQsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ2hELElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3hFLFNBQVMsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ2hELElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sVUFBVSxDQUFDLENBQUM7aUJBQ2hFO2dCQUNELElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLGtCQUFrQixFQUFFLENBQUM7Z0JBQzVDLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLDZCQUE2QixFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUM5RSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQztnQkFDaEQsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLEVBQUUsT0FBTyxFQUFFLHFCQUFxQixJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFBO2dCQUM5RixPQUFPLElBQUksQ0FBQyxtQkFBbUIsQ0FBQztnQkFDaEMsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUM7WUFDakMsQ0FBQztZQUNELGVBQWU7Z0JBQ1gsTUFBTSxZQUFZLEdBQUcsRUFBRSxDQUFDO2dCQUN4QixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtvQkFDbkQsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7aUJBQ3ZEO2dCQUNELEdBQUcsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUNoRSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsRUFBRSxPQUFPLEVBQUUseUJBQXlCLFlBQVksQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUE7WUFDN0YsQ0FBQztZQUVELFdBQVc7Z0JBQ1AsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7b0JBQ25ELE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDMUMsSUFBSSxRQUFRLENBQUMsS0FBSyxFQUFFO3dCQUNoQixDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLDZCQUE2QixDQUFDLENBQUM7cUJBQ3hFO3lCQUNJLElBQUksUUFBUSxDQUFDLEtBQUssRUFBRTt3QkFDckIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSw2QkFBNkIsQ0FBQyxDQUFDO3FCQUN4RTtpQkFDSjtnQkFDRCxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDN0IsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsNkJBQTZCLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQzlFLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLHFCQUFxQixFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO2dCQUM3RCxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQztnQkFDaEQsT0FBTyxJQUFJLENBQUMsbUJBQW1CLENBQUM7WUFDcEMsQ0FBQztZQUNELDZCQUE2QixDQUFFLENBQWdCO2dCQUMzQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7b0JBQUUsT0FBTztnQkFFekUsSUFBSSxDQUFDLENBQUMsT0FBTyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsT0FBTyxLQUFLLENBQUMsRUFBRTtvQkFDckMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQztpQkFDekM7cUJBQ0ksSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLEtBQUssRUFBRSxFQUFFO29CQUNuRCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO2lCQUN2QztxQkFDSSxJQUFJLENBQUMsQ0FBQyxPQUFPLEtBQUssRUFBRSxFQUFFO29CQUN2QixJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7aUJBQ3RCO1lBQ0wsQ0FBQztTQUNKO1FBbFRZLGlCQUFTLFlBa1RyQixDQUFBO1FBQUEsQ0FBQztJQUVOLENBQUMsRUFyVGdCLE9BQU8sR0FBUCxTQUFPLEtBQVAsU0FBTyxRQXFUdkI7SUFDRCxTQUFnQixTQUFTLENBQUUsR0FBVTtRQUNqQyxPQUFPLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDeEMsQ0FBQztJQUZlLFdBQVMsWUFFeEIsQ0FBQTtBQUNMLENBQUMsRUF4VVMsQ0FBQyxLQUFELENBQUMsUUF3VVY7QUFJRCxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxZQUFZLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyJ9