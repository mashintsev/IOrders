Ext.regController('SaleOrder', {

	onBackButtonTap: function(options) {
		
		options.view.ownerViewConfig.editing = !(options.closeEditing || false) ;
		
		IOrders.viewport.setActiveItem(Ext.create(options.view.ownerViewConfig), IOrders.viewport.anims.back);
		
	},

	onShowCustomerButtonTap: function(options) {

		var customer = options.view.customerRecord;

		Ext.Msg.alert('', 'Клиент: ' + customer.get('name').replace(/"/g, '') + '<br/>' +'Адрес: ' + customer.get('address'));
	},

	onSaveButtonTap: function(options) {
		
		Ext.dispatch(Ext.apply(options, {
			action: 'saveOffer'
		}));

		Ext.dispatch(Ext.apply(options, {
			action: 'onBackButtonTap',
			closeEditing: true
		}));
	},

	saveOffer: function(options) {
		var view = options.view,
		    offerStore = view.productStore,
		    saleOrderPosStore = view.saleOrderPositionStore
		;
		
		//offerStore.clearFilter(true);
		
		Ext.each(offerStore.getUpdatedRecords(), function(rec) {
			var posRec = saleOrderPosStore.findRecord('product', rec.get('product'), undefined, undefined, true, true);
			
			if (!posRec) {
				saleOrderPosStore.add (Ext.ModelMgr.create(Ext.apply({
							saleorder: view.saleOrder.getId()
						}, rec.data
					), 'SaleOrderPosition'
				));
			} else {
				posRec.editing = true;
				posRec.set('volume', rec.get('volume'));
				posRec.set('cost', rec.get('cost'));
				posRec.editing = false;
			}
			rec.commit(true);

		});

		var tc = saleOrderPosStore.sum('cost').toFixed(2);

		view.saleOrder.set ('totalCost', tc);
		saleOrderPosStore.sync();

		view.saleOrder.save();
		view.saleOrder.commit(true);

		if (view.bonusCost){
			view.customerRecord.set (
				'bonusCost',
				(view.bonusCost - tc).toFixed(2)
			);
			view.customerRecord.save();
			view.customerRecord.commit();
		}

	},

	onListItemTap: function(options) {
		
		var list = options.list,
			listEl = list.getEl()
		;
		
		if(listEl.hasCls('x-product-category-list')) {
			
			Ext.dispatch(Ext.apply(options, {action: 'onProductCategoryListItemTap'}));
			
		} else if (listEl.hasCls('x-product-list')) {

			var target = Ext.get(options.event.target);

			if(target.hasCls('crec')) {

				Ext.dispatch({controller: 'SaleOrder', action: 'toggleBonusOn', view: list.up('saleorderview'), productRec: list.getRecord(options.item)});
			}
		} else if(listEl.hasCls('x-deps-list')) {
			
			var oldCard = IOrders.viewport.getActiveItem();
			
			var newCard = Ext.create({
				xtype: 'saleorderview',
				saleOrder: options.saleOrder,
				ownerViewConfig: {
                    xtype: 'navigatorview',
                    layout: IOrders.newDesign ? {type: 'hbox', pack: 'justify', align: 'stretch'} : 'fit',
                    extendable: oldCard.extendable,
                    isObjectView: oldCard.isObjectView,
                    isSetView: oldCard.isSetView,
                    objectRecord: oldCard.objectRecord,
                    tableRecord: oldCard.tableRecord,
                    ownerViewConfig: oldCard.ownerViewConfig
                }
			});
			
			var failureCb = function (n) {
				Ext.Msg.alert ('Ошибка', 'Не получилось загрузить список '+n, function() {
					oldCard.setLoading(false);
				});
			};
			
			oldCard.setLoading(true);
			
			newCard.offerCategoryStore.load({
				limit: 0,
				callback: function(r, o, s){
					
					if (!s) failureCb('категорий'); else {
						
						newCard.productStore = createStore('Offer', {
							remoteFilter: true,
							remoteSort: true,
							groupField: 'firstName',
							getGroupString: function(rec) {
								return rec.get(this.groupField).replace(/ /g, '_');
							},
							sorters: [{property: 'firstName', direction: 'ASC'}, {property: 'name', direction: 'ASC'}],
							filters: [{property: 'customer', value: options.saleOrder.get('customer')}],
							filter: function(filters, value) {

								var bonusProductStore = newCard.bonusProductStore,
									bonusProgramStore = newCard.bonusProgramStore
								;

								if(filters.contains && filters.contains(this.isFocusedFilter) || filters == this.isFocusedFilter) {
									bonusProgramStore.filter({property: 'isFocused', value: true});
									bonusProductStore.filterBy(function(it) {
										return bonusProgramStore.findExact('id', it.get('bonusprogram')) !== -1 ? true : false;
									});
								}

								Ext.data.Store.prototype.filter.apply(this, arguments);

								if(filters.contains && filters.contains(this.isFocusedFilter) || filters == this.isFocusedFilter) {
									bonusProductStore.clearFilter(true);
									bonusProgramStore.clearFilter(true);
								}
							},
							volumeFilter: new Ext.util.Filter({
								filterFn: function(item) {
									return item.get('volume') > 0;
								}
							}),
							isFocusedFilter: new Ext.util.Filter({
								filterFn: function(item) {
									return newCard.bonusProductStore.findExact('product', item.get('product')) !== -1 ? true : false;
								}
							})
						});

						newCard.productStore.on('load', newCard.offerCategoryStore.initLastActive, newCard.offerCategoryStore);

						var saleOrderPositionStore = newCard.saleOrderPositionStore = createStore('SaleOrderPosition', {
							remoteFilter: true,
							filters: [{
								property: 'saleorder',
								value: options.saleOrder.getId()
							}]
						});

						newCard.productList = newCard.productPanel.add(Ext.apply(offerProductList, {flex: 3, store: newCard.productStore}));
						newCard.productListIndexBar = newCard.productPanel.add(new HorizontalIndexBar({hidden: !newCard.indexBarMode, list: newCard.productList}));

						newCard.productStore.load({
							limit: 0,
							callback: function(r, o, s) {
								
								if (s) {

									newCard.productPanel.doLayout(); 	
									newCard.productStore.remoteFilter = false;
									
									saleOrderPositionStore.load({
										limit: 0,
										callback: function(records, operation, s) {
											if(s) {

												Ext.each(records, function(rec, idx, all) {
													var offerRec = newCard.productStore.findRecord('product', rec.get('product'), undefined, undefined, true, true);

													if (offerRec) {

														offerRec.editing = true;
														offerRec.set('volume', rec.get('volume'));
														offerRec.set('cost', rec.get('cost'));
														offerRec.commit(true);

													}
													
												});
												
												var customer = newCard.saleOrder.get('customer');
												
												if (customer) {
													Ext.ModelMgr.getModel('Customer').load(customer, {
														success: function(rec) {
															newCard.customerRecord = rec;
															if (newCard.saleOrder.get('isBonus')){
																newCard.bonusCost = rec.get('bonusCost') + newCard.saleOrder.get('totalCost');
															};
															Ext.dispatch({
																controller: 'SaleOrder',
																action: 'calculateTotalCost',
																view: newCard
															});
														}
													});
												} else {
													console.log ('SaleOrder: empty customer');
												}

												newCard.bonusProgramStore = createStore('BonusProgram', Ext.apply(getSortersConfig('BonusProgram', {})));
												newCard.bonusProductStore = createStore('BonusProgramProduct', Ext.apply(getSortersConfig('BonusProgramProduct', {})));

												newCard.bonusProgramStore.load({
													limit: 0,
													callback: function() {
														newCard.bonusProgramStore.remoteFilter = false;

														newCard.bonusProductStore.load({
															limit: 0,
															callback: function() {

																newCard.bonusProductStore.remoteFilter = false;

																if(records.length) {
																	newCard.productStore.filter(newCard.productStore.volumeFilter);
																} else {

																	var bonusProductStore = newCard.bonusProductStore,
																		bonusProgramStore = newCard.bonusProgramStore
																	;
																	bonusProgramStore.filter({property: 'isFocused', value: true});
																	bonusProductStore.filterBy(function(it) {
																		return bonusProgramStore.findExact('id', it.get('bonusprogram')) !== -1 ? true : false;
																	});

																	newCard.productStore.filter(newCard.productStore.isFocusedFilter);

																	bonusProductStore.clearFilter(true);
																	bonusProgramStore.clearFilter(true);
																}

																oldCard.setLoading(false);
																IOrders.viewport.setActiveItem(newCard);
																newCard.productListIndexBar.loadIndex();

																Ext.dispatch(Ext.apply(options, {action: 'expandFocusedProduct', view: newCard}));
															}
														});
													}
												});
											} else failureCb('товаров');
										}
									});
								} else failureCb('остатков');
							}
						});
					}
				}
			});
			
		};
	},
	
	onListItemSwipe: function(options) {

		var rec = options.list.store.getAt(options.idx),
			volume = parseInt(rec.get('volume') ? rec.get('volume') : '0'),
			factor = parseInt(rec.get('factor')),
			sign = options.event.direction === 'left' ? -1 : 1
		;

		!volume && (volume = 0);

		Ext.dispatch (Ext.apply(options, {
			action: 'setVolume',
			volume: volume + sign * factor,
			rec: rec
		}));

	},
	
	setVolume: function (options) {
		var volume = options.volume;
		
		var rec = options.rec,
			oldCost = rec.get('cost'),
		    view = options.list.up('saleorderview')
		;
		
		oldCost > 0 || (oldCost = 0);
		
//		options.list.scroller.disable();
		
		volume < 0 && (volume = 0);
		
		var cost = volume * parseInt(rec.get('rel')) * parseFloat(rec.get('price'));
		
		rec.editing=true;
		rec.set('volume', volume);		
		rec.set('cost', cost.toFixed(2));
		rec.editing = false;
		
		Ext.dispatch(Ext.apply(options, {
			action: 'saveOffer',
			view: view
		}));
		
		Ext.dispatch(Ext.apply(options, {
			action: 'calculateTotalCost'
		}));
		
		var iel = Ext.get(options.item); 
		iel.down('.cost').dom.innerHTML = rec.get('cost');
		iel.down('.volume').dom.innerHTML = rec.get('volume');
		
//		options.list.scroller.enable();
		
	},
	
	calculateTotalCost: function(options) {
		
		var view = options.view,
			btb = view.getDockedComponent('bottomToolbar'),
			tc = view.saleOrder.get('totalCost') || 0
		;
		
		btb.getComponent('ShowCustomer').setText( btb.titleTpl.apply ({
			totalCost: tc.toFixed(2),
			bonusRemains: view.saleOrder.get('isBonus') ? (view.bonusCost - tc).toFixed(2): undefined
		}));
	},
	
	onProductCategoryListItemTap: function(options) {

		var list = options.list,
			rec = list.getRecord(options.item),
			view = list.up('saleorderview')
		;

		view.setLoading(true);

		Ext.apply(options, {action: 'addOfferProductList', view: view, categoryRec: rec});

		Ext.defer(Ext.dispatch, 100, this, [options]);
	},

	onProductListItemLongTap: function(options) {

		var list = options.list,
			item = options.item,
			iel = Ext.get(item),
			productRec = list.getRecord(item),
			view = list.up('saleorderview')
		;

		iel.addCls('editing');

		if(!view.pricePanel) {

			 view.pricePanel = Ext.create({
				xtype: 'tabpanel',
				tabBarDock: 'top',
				tabBar: {ui: 'light', height: 50},
				floating: true,
				width: list.getWidth() / 2,
				items: [
					{
						xtype: 'list',
						title: 'Товар',
						scroll: false,
						itemId: 'productList',
						itemTpl: getItemTplMeta('Product', {useDeps: false, groupField: 'category'}).itemTpl,
						store: createStore('Product', Ext.apply(getSortersConfig('Product', {})))
					},
					{
						xtype: 'list',
						title: 'Цены',
						itemId: 'priceList',
						itemTpl: getItemTplMeta('Price', {useDeps: false, groupField: 'category', filterObject: {modelName: 'Product'}}).itemTpl,
						store: createStore('Price', Ext.apply(getSortersConfig('Price', {})))
					},
					{
						xtype: 'list',
						title: 'Отгрузки',
						itemId: 'shipmentList',
						itemTpl: getItemTpl('ShipmentProduct'),
						store: createStore('Shipment', Ext.apply(getSortersConfig('Shipment', {})))
					}
				],
				listeners: {
					hide: function() {
						this.iel.removeCls('editing');
					},
					cardswitch: function(panel, newC, oldC) {

						localStorage.setItem('productInfoTab', newC.itemId);
					}
				}
			});

			 view.cmpLinkArray.push(view.pricePanel);
		}

		view.pricePanel.setHeight(list.getHeight() * 2 / 3);
		view.pricePanel.iel = iel;

		var productStore = view.pricePanel.getComponent('productList').store,
			priceStore = view.pricePanel.getComponent('priceList').store,
			shipmentStore = view.pricePanel.getComponent('shipmentList').store
		;

		shipmentStore.clearFilter(true);
		
		productStore.load({
			filters: [{property: 'id', value: productRec.get('product')}],
			scope: view,
			limit: 0,
			callback: function() {

				priceStore.load({
					filters: [{property: 'product', value: productRec.get('product')}],
					scope: this,
					limit: 0,
					callback: function() {
						
						shipmentStore.load({
							scope: this,
							limit: 0,
							filters: [{property: 'customer', value: this.saleOrder.get('customer')}],
							callback: function() {

								var shipPosStore = this.pricePanel.shipPositionStore = createStore('ShipmentPosition', {});
								shipPosStore.load({
									filters: [{property: 'product', value: productRec.get('product')}],
									scope: this,
									limit: 0,
									callback: function() {

										shipmentStore.filterBy(function(item) {
											return shipPosStore.findExact('shipment', item.get('id')) !== -1;
										}, this);

										shipmentStore.each(function(rec) {

											var pos = shipPosStore.findRecord('shipment', rec.getId(), undefined, undefined, true , true);
											Ext.apply(rec.data, {name: productStore.getAt(0).get('name'), price: pos.get('price'), volume: pos.get('vol')});
										});

										this.pricePanel.showBy(iel, false, false);
										this.pricePanel.setActiveItem(localStorage.getItem('productInfoTab'));

										this.pricePanel.getComponent('shipmentList').refresh();
									}
								});
							}
						});
					}
				});
			}
		});
	},

	addOfferProductList: function(options) {
		
		var rec = options.categoryRec,
			view = options.view,
		    productStore = view.productStore,
		    filters = []
		;
		
		productStore.clearFilter(true);
		
		rec && filters.push({
			property: 'category',
			value: rec.get('category')
		});
		
		view.isShowSaleOrder && filters.push(productStore.volumeFilter);
		view.bonusMode && filters.push(productStore.bonusFilter);

		productStore.filter(filters);

		view.productListIndexBar.loadIndex();
		view.productList.scroller.scrollTo ({y:0});
		
		if (view.modeActive)
			Ext.dispatch (Ext.apply (options, {action: 'toggleActiveOn'}));

		Ext.dispatch(Ext.apply(options, {action: 'expandFocusedProduct'}));

		view.setLoading(false);
	},

	expandFocusedProduct: function(options) {
		var view = options.view,
			doms = view.productList.getEl().query('.x-list-item .focused')
		;

		Ext.each(doms, function(dom) {
			var el = Ext.get(dom);

			el.up('.x-list-item').addCls('active').up('.x-list-group-items').addCls('hasActive');
		});
	},

	toggleActiveOn: function( options ) {
		var view = options.view;

		view.modeActive = true;

		var addActiveCls = function(dom) {
			var el = Ext.get(dom);

			el.up('.x-list-item').addCls('active').up('.x-list-group-items').addCls('hasActive');
		}; 

		//productList
		Ext.each (view.productList.getEl().query('.x-list-item .active'), addActiveCls);

		//categoryList
		view.productCategoryList.scroller.enable();
		Ext.each(view.productCategoryList.getEl().query('.x-list-item .active'), addActiveCls);
	},
	
	toggleActiveOff: function( options ) {
		var view = options.view;

		view.modeActive = false;

		var removeActiveCls = function(dom) {
			var el = Ext.get(dom);

			el.removeCls('hasActive');
		};

		Ext.each(view.productList.getEl().query('.x-list-group-items'), removeActiveCls);

		view.productCategoryList.scroller.scrollTo({y:0});
		view.productCategoryList.scroller.disable();
		Ext.each(view.productCategoryList.getEl().query('.x-list-group-items'), removeActiveCls);
	},

	toggleShowSaleOrderOn: function(options) {

		Ext.dispatch(Ext.apply(options, {action: 'beforeShowSaleOrder', mode: true}));

		var view = options.view;

		view.productStore.filtersSnapshot = view.productStore.filters.items;
		view.productStore.clearFilter(true);
		view.productStore.filter(view.productStore.volumeFilter);

		view.productCategoryList.deselect(
			view.productCategoryList.selectionSnaphot = view.productCategoryList.getSelectedRecords()
		);

		view.offerCategoryStore.remoteFilter = false;
		view.offerCategoryStore.filter(new Ext.util.Filter({
			filterFn: function(item) {
				return view.productStore.findExact('category', item.get('category')) > -1 ? true : false;
			}
		}));

		Ext.dispatch(Ext.apply(options, {action: 'afterFilterProductStore'}));
	},

	toggleShowSaleOrderOff: function(options) {

		Ext.dispatch(Ext.apply(options, {action: 'beforeShowSaleOrder', mode: false}));

		var view = options.view;

		view.offerCategoryStore.clearFilter();

		view.productCategoryList.getSelectionModel().select(
			view.productCategoryList.selectionSnaphot
		);

		view.productStore.clearFilter(true);
		view.productStore.filtersSnapshot && view.productStore.filter(view.productStore.filtersSnapshot);

		Ext.dispatch(Ext.apply(options, {action: 'afterFilterProductStore'}));
	},

	beforeShowSaleOrder: function(options) {

		var view = options.view;

		view.setLoading(true);
		view.isShowSaleOrder = options.mode;
	},

	afterFilterProductStore: function(options) {

		var view = options.view;

		view.productCategoryList.scroller && view.productCategoryList.scroller.scrollTo({y: 0});
		view.productCategoryList.el.toggleCls('expandable');

		view.productList.scroller.scrollTo ({y:0});
		view.productList.el.toggleCls('expandable');

		view.productListIndexBar.loadIndex();

		Ext.dispatch(Ext.apply(options, {action: 'expandFocusedProduct'}));

		view.modeActive && Ext.dispatch(Ext.apply(options, {action: 'toggleActiveOn'}));

		view.setLoading(false);
	},

	onModeButtonTap: function(options) {

		var btn = options.btn,
			pressed = options.pressed
		;

		changeBtnText(btn);

		Ext.dispatch(Ext.apply(options, {
			action: 'toggle' + btn.itemId + (pressed ? 'On' : 'Off')
		}));
	},

	toggleBonusOn: function(options) {

		var view = options.view,
			productRec = options.productRec
		;

		if(!view.bonusPanel) { 
			view.bonusPanel = Ext.create({
				xtype: 'panel',
				floating: true,
				centered: true,
				layout: 'fit',
				width: view.getWidth() / 2,
				height: view.getHeight() * 2 / 3,
				dockedItems: [],
				items: [{
					xtype: 'list',
					itemId: 'bonusList',
					itemTpl: getItemTplMeta('BonusProgram', {useDeps: false}).itemTpl,
					store: view.bonusProgramStore,
					listeners: {
						itemtap: function(list, idx, item, e) {
							Ext.dispatch({controller: 'SaleOrder',action: 'onBonusItemSelect', view: view, list: list, idx: idx, item: item, event: e});
						}
					}
				}],
				listeners: {
					hide: function() {

						if(!view.bonusMode) {

							var segBtn = view.getDockedComponent('top').getComponent('ModeChanger'),
								btn = segBtn.getComponent('Bonus')
							;
							segBtn.setPressed(btn, false, true);
							changeBtnText(btn);
						}
						view.bonusProductStore.clearFilter(true);
						view.bonusProgramStore.clearFilter(true);
					}
				}
			});

			view.cmpLinkArray.push(view.bonusPanel);
		}

		var list = view.bonusPanel.getComponent('bonusList');

		list.refresh();
		view.bonusPanel.show();

		if(productRec) {

			view.bonusProductStore.filter({property: 'product', value: productRec.get('product')});

			view.bonusProgramStore.filterBy(function(item) {return view.bonusProductStore.findExact('bonusprogram', item.getId()) !== -1;});

			var bonusList = view.bonusPanel.getComponent('bonusList');
			bonusList.selectSnapshot && bonusList.selModel.select(bonusList.selectSnapshot);

			list.scroller.scrollTo({y: 0});
		}
	},

	toggleBonusOff: function(options) {

		var view = options.view,
			segBtn = view.getDockedComponent('top').getComponent('ModeChanger'),
			bonusBtn = segBtn.getComponent('Bonus')
		;

		segBtn.setPressed(bonusBtn, true);
	},

	onGroupLastnameButtonTap: function(options) {

		var view = options.view;

		view.productStore.groupField = 'lastName';
		view.productStore.sorters.removeAll();
		view.productStore.remoteSort = false;
		view.productStore.sort([{property: 'lastName', direction: 'ASC'}, {property: 'name', direction: 'ASC'}]);

		view.productList.refresh();

		view.productListIndexBar.loadIndex();
	},

	onGroupFirstnameButtonTap: function(options) {

		var view = options.view;

		view.productStore.groupField = 'firstName';
		view.productStore.sorters.removeAll();
		view.productStore.remoteSort = false;
		view.productStore.sort([{property: 'firstName', direction: 'ASC'}, {property: 'name', direction: 'ASC'}]);

		view.productList.refresh();

		view.productListIndexBar.loadIndex();
	},

	onAllBonusButtonTap: function(options) {

		var view = options.view,
			bonusList = view.bonusPanel.getComponent('bonusList')
		;

		bonusList.selModel.select(bonusList.store.getRange());
	},

	onBonusItemSelect: function(options) {

		var view = options.view,
			bonusList = view.bonusPanel.getComponent('bonusList'),
			tapedBonus = bonusList.getRecord(options.item),
			selectedBonus = bonusList.selModel.getSelection()[0]
		;

		if(!selectedBonus || tapedBonus.getId() != selectedBonus.getId()) {

			bonusList.selectSnapshot = tapedBonus;

			view.bonusProductStore.filterBy(function(rec, id) {
				return tapedBonus.get('id') == rec.get('bonusprogram');
			});

			view.productStore.bonusFilter = view.productStore.bonusFilter || new Ext.util.Filter({
				filterFn: function(item) {
					return view.bonusProductStore.findExact('product', item.get('product')) != -1;
				}
			});

			view.bonusMode || (view.productStore.filtersSnapshot = view.productStore.filters.items);
			view.productStore.clearFilter(true);
			view.productStore.filter(view.productStore.bonusFilter);

			view.bonusProductStore.clearFilter(true);

			if(view.productStore.getCount() > 0) {

				view.offerCategoryStore.remoteFilter = false;
				view.offerCategoryStore.clearFilter();
				view.offerCategoryStore.filter(new Ext.util.Filter({
					filterFn: function(item) {
						return view.productStore.findExact('category', item.get('category')) > -1 ? true : false;
					}
				}));

				view.bonusMode || Ext.dispatch(Ext.apply(options, {action: 'afterFilterProductStore'}));
				view.bonusMode = true;
			} else {
				Ext.Msg.alert('Нет товаров', 'По выбранной акции нет товаров для заказа');
				view.productStore.clearFilter(true);
				view.productStore.filter(view.productStore.filtersSnapshot);
			}
		} else {

			view.productStore.clearFilter(true);
			view.productStore.filter(view.productStore.filtersSnapshot);

			view.offerCategoryStore.clearFilter();

			view.bonusMode && Ext.dispatch(Ext.apply(options, {action: 'afterFilterProductStore'}));
			view.bonusMode = false;

			bonusList.selectSnapshot = undefined;
		}

		view.productListIndexBar.loadIndex();
		view.bonusPanel.hide();
	},

	onShowIndexBarButtonTap: function(options) {

		var view = options.view,
			btn = options.btn,
			t = btn.text
		;

		btn.setText(btn.altText);
		btn.altText = t;

		view.indexBarMode = !view.indexBarMode;

		view.productListIndexBar[view.indexBarMode ? 'show' : 'hide']();
		view.productPanel.doLayout();

		localStorage.setItem('indexBarMode', view.indexBarMode);
	}
});