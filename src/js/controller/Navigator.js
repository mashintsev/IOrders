Ext.regController('Navigator', {

	afterAppLaunch: function(options) {
		
		this.mon(IOrders.xi, 'uploadrecord', this.onUploadRecord, this);
		this.mon(IOrders.xi, 'tableload', this.onTableLoad, this);
        
        this.mon(IOrders.xi, 'pullrefresh', function(modelName) {
			if(IOrders.xi.fireEvent ('beforetableload', modelName) !== false) {
                IOrders.xi.request ({
                    command: 'download',
                    timeout: 120000,
                    scope: IOrders.dbeng,
                    success: function( r,o ) {
                        IOrders.dbeng.processDowloadData (r,o);
                        var data = Ext.DomQuery.select ( o.params.filter, r.responseXML );
                        if ( !data || data.length == 0 )
                            IOrders.xi.fireEvent ('tableloadfull', o.params.filter);
                    },
                    xi: IOrders.xi,
                    params: {filter: modelName}
                });
            }
        }, this);
		
		IOrders.xi.on ('beforetableload', this.beforeTableLoad);
		
		IOrders.xi.on ('tableloadfull', function(t) {
			var s = Ext.getStore (t);
			
			if (s && s.autoLoad) {
				s.currentPage = 1;
				s.load();
			}
            
            var view = IOrders.viewport.getActiveItem(),
                tableStore = Ext.getStore('tables')
            ;
            tableStore.getById(t).set('loading', false);
            
            if(view.isSetView && view.tableRecord === t) {
                view.setViewStore.currentPage = 1;
                view.setViewStore.load();

                var list = view.form.getComponent('list'),
                    pullPlugin = list.pullPlugin
                ;
                pullPlugin.isLoading && pullPlugin.onLoadComplete.call(pullPlugin);

                list.setLoading(false);
                view.form.scroller.scrollTo({y: 0});
            } else if(view.isObjectView) {
                var depStore = view.depStore,
                    depRec = depStore.findRecord('id', t, undefined, undefined, true, true),
                    depTable = tableStore.getById(t),
                    objectTable = tableStore.getById(view.objectRecord.modelName)
                ;
                
                if(depRec) {
                    depRec.set('loading', false);
                    loadDepData(depRec, depTable, view, undefined, true);
                }
            }
            
            var tableRec = Ext.getStore('tables').getById(t);
            loadDepData(tableRec, tableRec, undefined, undefined, true);
            
		});
		
        
        IOrders.xi.on('beforeupload', this.onBeforeUpload, this);
	},

    onBeforeUpload: function(store) {
        
        var view = IOrders.viewport.getActiveItem();
		
		if(view.isXType('navigatorview')) {
			
			if(view.isObjectView) {
                
                if(store.findExact('id', view.objectRecord.get('xid')) !== -1)
                    this.controlButtonsVisibilities(view, true);
            }
        }
    },

	onUploadRecord: function(record) {
		
		var view = IOrders.viewport.getActiveItem();
		
		if(view.isXType('navigatorview')) {
			
			if(view.isObjectView) {
				
				var objRec = view.objectRecord,
					form = view.form
				;
				
				if(objRec.get('xid') == record.get('xid')) {
					
					form.loadRecord(record);
					view.objectRecord = record;
					
					var statusBar = form.getComponent('statusToolbar');
					
					if(statusBar) {
						
						var segBtn = statusBar.getComponent('processing'),
							state = record.get('processing');
						;
						
						segBtn.getComponent(state).enable();
						segBtn.setPressed(state, true, false);
						segBtn.items.each(function(b) {
							b.disable();
							b.canEnable && b[b.canEnable(state) ? 'enable' : 'disable']();
							b.pressed && b.enable();
						});
						
					}

					record.fields.getByKey('processing') && this.controlButtonsVisibilities(view, record.get('processing') != 'draft' && !record.get('serverPhantom'));
				}
				
			} else if(view.isSetView) {
				
				var store = view.setViewStore,
					sameRecord = store.findRecord('xid', record.get('xid'), undefined, undefined, true, true)
				;
				
				if (sameRecord)
					sameRecord.set(record.data)
				;
				
			}
		}
	},

	beforeTableLoad: function(table) {
		var view = IOrders.viewport.getActiveItem(),
            tableRec = Ext.getStore('tables').getById(table)
		;
		
        if(!tableRec.get('loading')) {
            if(view.isObjectView && view.depList) {
                
                var depStore = view.depStore,
                    depRec = depStore.findRecord('id', table, undefined, undefined, true, true)
                ;
                
                if(depRec) {
                    depRec.set ('loading', true);
                }
            }
            
            tableRec.set('loading', true);
        } else {
            return false;
        }
	},

	onTableLoad: function(table, willContinue) {
		
		var view = IOrders.viewport.getActiveItem(),
			tableStore = Ext.getStore('tables')
		;
		
		if(view.isObjectView) {
			
			var depStore = view.depStore,
				depRec = depStore.findRecord('id', table, undefined, undefined, true, true),
				depTable = tableStore.getById(table),
				objectTable = tableStore.getById(view.objectRecord.modelName)
			;
			
			if(depRec) {
                depRec.set('loading', willContinue === true);
				loadDepData(depRec, depTable, view, undefined, true);
			}
		}
        
        var tableRec = Ext.getStore('tables').getById(table);
        loadDepData(tableRec, tableRec, undefined, undefined, true);
	},

	onBackButtonTap: function(options) {
		
		var view = options.view,
			rec = view.form.getRecord()
		;
        
        var ownerViewConfig = view.ownerViewConfig;
        
        while(!ownerViewConfig.isSetView && ownerViewConfig.ownerViewConfig) {
            ownerViewConfig = ownerViewConfig.ownerViewConfig;
        }
        
        var newCard = Ext.create(ownerViewConfig);
        
		if (newCard.isSetView) {
			Ext.dispatch(Ext.apply(options, {action: 'loadSetViewStore', newCard: newCard, anim: IOrders.viewport.anims.back}));
		} else {
			IOrders.viewport.setActiveItem(newCard, IOrders.viewport.anims.back);
		}
	},

	onHomeButtonTap: function(options) {

		IOrders.viewport.setActiveItem(Ext.create({
			xtype: 'navigatorview',
			layout: 'fit',
			isObjectView: true,
			objectRecord: IOrders.mainMenuRecord
		}), IOrders.viewport.anims.home);
	},

	onDeleteButtonTap: function(options) {

		var view = options.view,
			record = view.objectRecord
		;

        if(!this.checkRecordInUpload(record.get('xid'))) {
            view.setLoading(true);
            Ext.ModelMgr.getModel(record.modelName).prototype.getProxy().destroy(new Ext.data.Operation({id: record.getId(), records: [record]}), function(operation) {
    
                var tableRec = Ext.getStore('tables').getById(record.modelName);
                loadDepData(tableRec, tableRec, undefined, undefined, true);
                view.setLoading(false);
                Ext.dispatch(Ext.apply(options, {action: 'goBack'}));
            });
            
        } else {
            Ext.Msg.alert('', 'Нельзя удалить. Запись отправляется на сервер');
        }
	},

	onSaveButtonTap: function(options) {
		
		var view = options.view,
		    form = view.form,
		    rec = form.getRecord(),
		    dirty = rec.dirty
		;
		
		form.updateRecord(rec);
		
		var errors = rec.validate();
		
		if(errors.isValid()) {
			
			var btn = options.btn;
			
			if (btn) {
				btn.setText('Редактировать');
				
				Ext.apply(btn, {name: 'Edit'});
				
				options.view.depStore.each(function(rec) {
					rec.set('editing', false);
				});
                
                if(options.view.isNew) {
                    var statusBar = form.getComponent('statusToolbar'),
                        state = undefined
                    ;
                        
                    if(statusBar) {
                        
                        var segBtn = statusBar.getComponent('processing');
                        
                        segBtn.items.each(function(b) {
                            if(b.pressed) {
                                state = b.name;
                                return false;
                            }
                            return true;
                        });
                        
                    }
                    
                    rec.set('processing', state);
                }
				
				var toolbar = btn.up('toolbar');
                
				Ext.dispatch(Ext.apply(options, {action: 'setEditing', editing: false}));

				rec.fields.getByKey('processing') && this.controlButtonsVisibilities(view, rec.get('processing') != 'draft' && !rec.get('serverPhantom'));
			}
			
            view.isNew = false;
            
			rec.save({callback: function() {
                var tableRec = Ext.getStore('tables').getById(rec.modelName);
                loadDepData(tableRec, tableRec, undefined, undefined, true);
            }});
			view.fireEvent ('saved', rec);
			
		} else {
			
			var msg = '';
			
			errors.each(function(err) {
				msg += 'Поле ' + err.field + ' ' + err.message;
			});
			
			Ext.Msg.alert('Ошибка валидации', msg, Ext.emptyFn);
			
		}
	},
	
	onEditButtonTap: function(options) {
		
        if(!this.checkRecordInUpload(options.view.objectRecord.get('xid'))) {
            var btn = options.btn;
            btn.setText('Сохранить');
            Ext.apply(btn, {name: 'Save'});
            
            options.view.depStore.each(function(rec) {
                rec.set('editing', true);
            });
            
            var toolbar = btn.up('toolbar');
            //toolbar.getComponent('Cancel').show();
            
            Ext.dispatch(Ext.apply(options, {action: 'setEditing', editing: true}));
        } else {
            Ext.Msg.alert('', 'Редактирование недоступно. Запись отправляется на сервер');
        }
	},
    
    checkRecordInUpload: function(xid) {
        
        var store = Ext.getStore('ToUpload');
        
        return store && store.findExact('id', xid) !== -1;
    },
	
	onCancelButtonTap: function(options) {
		
		options.view.form.load(options.view.form.getRecord());
		
		var toolbar = options.btn.up('toolbar');
		//toolbar.getComponent('Cancel').hide();
		
		var saveEditBtn = toolbar.getComponent('SaveEdit');
		
		options.view.depStore.each(function(rec) {
			rec.set('editing', false);
		});
		
		saveEditBtn.setText('Редактировать');
		Ext.apply(saveEditBtn, {name: 'Edit'});
		
		Ext.dispatch(Ext.apply(options, {action: 'setEditing', editing: false}));
	},

	controlButtonsVisibilities: function(view, hide) {

		var topBar = view.getDockedComponent('top'),
			delBtn = topBar.getComponent('Delete'),
			editBtn = topBar.getComponent('SaveEdit')
		;
	
		delBtn && delBtn[hide ? 'addCls' : 'removeCls']('disable');
	
		editBtn && editBtn[hide ? 'addCls' : 'removeCls']('disable');
	},

	setEditing: function(options) {
		options.view.setFieldsDisabled(!options.editing);
		options.view.editing = options.editing;

		var toolbar = options.btn.up('toolbar');
		toolbar.getComponent('Add')[options.editing ? 'hide' : 'show']();
	},
	
	onAddButtonTap: function(options) {
		
		var rec = undefined;

		if(options.view.isObjectView) {

            var tableRec = Ext.getStore('tables').getById(options.view.objectRecord.modelName),
                parentColumns = tableRec.getParentColumns()
            ;

            rec = Ext.ModelMgr.create({serverPhantom: true}, options.view.objectRecord.modelName);

            parentColumns.each(function(col) {
                rec.set(col.get('name'), options.view.objectRecord.get(col.get('name')));
            });

		} else if(options.view.isSetView) {
			rec = Ext.ModelMgr.create({serverPhantom: true}, options.view.tableRecord);
			
			rec.set (
				options.view.objectRecord.modelName.toLowerCase(),
				options.view.objectRecord.getId()
			);
		}
		
		if (rec.modelName === 'SaleOrder' || rec.modelName === 'EncashmentRequest') {
			rec.set('date', getNextWorkDay());
		}
		
		var oldCard = IOrders.viewport.getActiveItem();
		if(rec.modelName === 'Uncashment') {

			Ext.dispatch(Ext.apply(options, {action: 'createUncashmentView'}));
		} else {
			IOrders.viewport.setActiveItem(Ext.create(Ext.apply(createNavigatorView(rec, oldCard, false, true), {isNew: true})));
		}
		
		
	},
	
	onListItemTap: function(options) {
		
		var target = Ext.get(options.event.target),
		    rec = undefined,
		    list = options.list,
		    item = options.item,
	        view = list.up('navigatorview'),
		    isTableList = list.getEl().hasCls('x-table-list') ? true : false,
		    tappedRec = list.getRecord(item)
		;

		view.lastSelectedRecord = tappedRec;

		if (target.hasCls('x-button') && !target.hasCls('label-parent')) {
			
			if (target.hasCls('extend')) {
				
				options.isSetView = false;
				
				view.setLoading (true);
				
				var createdRecordModelName = isTableList
						? target.up('.dep').down('input').dom.value
						: list.getRecord(item).get('id'),
					objectRecord = isTableList
						? (list.modelForDeps && !Ext.getStore('tables').getById(tappedRec.modelName).hasIdColumn()
								? Ext.getStore(list.modelForDeps).getById(tappedRec.get(list.modelForDeps.toLowerCase())) 
								: tappedRec)
						: view.objectRecord
				;
					
				Ext.defer ( function () {
					
					rec = Ext.ModelMgr.create({serverPhantom: true}, createdRecordModelName);
					rec.set( objectRecord.modelName.toLowerCase(), objectRecord.getId() );
					
					if (rec.modelName === 'SaleOrder')
						rec.set('totalCost', '0')
					;
					
					if (rec.modelName === 'SaleOrder' || rec.modelName === 'EncashmentRequest')
						rec.set('date', getNextWorkDay())
					;
					
					if(createdRecordModelName === 'Encashment') {
						
						Ext.dispatch(Ext.apply(options, {
							action: 'createEncashmentView',
							objectRecord: objectRecord
						}));
					} else if(createdRecordModelName === 'Uncashment') {

						Ext.dispatch(Ext.apply(options, {action: 'createUncashmentView'}));
					} else {
						Ext.dispatch(Ext.apply(options, {
							action: 'createAndActivateView',
							record: rec,
							editing: true
						}));
					}

				}, 100);
			}
			
		} else if (options.isSetView) {
			
			tappedRec.get('count') && Ext.dispatch(Ext.apply(options, {
				action: 'createAndActivateView'
			}));
			
		} else if (isTableList && target.up('.dep')) {
			
			var dep = target.up('.dep');
			var count = dep.down('.count').dom.innerText;
			
			count && Ext.dispatch(Ext.apply(options, {
				controller: 'Navigator',
				action: 'createAndActivateView',
				record: list.modelForDeps && !Ext.getStore('tables').getById(tappedRec.modelName).hasIdColumn()
						? Ext.getStore(list.modelForDeps).getById(tappedRec.get(list.modelForDeps.toLowerCase())) 
						: tappedRec,
				tableRecord: dep.down('input').getAttribute('value'),
				isSetView: true,
				editing: false
			}));
			
		} else if (isTableList && target.hasCls('label-parent')) {
			
			var parentModel = target.down('input').getAttribute('property');
			parentModel = parentModel[0].toUpperCase() + parentModel.substring(1);

			Ext.ModelMgr.getModel(parentModel).load(parseInt(target.down('input').getAttribute('value')), {
				success: function(record) {

					Ext.dispatch(Ext.apply(options, {
						controller: 'Navigator',
						action: 'createAndActivateView',
						record: record,
						isSetView: false,
						editing: false
					}));
				}
			});

		} else {

			var table = Ext.getStore('tables').getById(tappedRec.modelName),
				depStore = table.deps()
			;

			if(depStore.getCount() !== 1 || table.hasExtendableDep()) {
				Ext.defer ( function() {

					Ext.dispatch(Ext.apply(options, {
						controller: 'Navigator',
						action: 'onListSelectionChange',
						view: view,
						selections: [list.getRecord(item)]
					}));
				}, 150);
			} else if(depStore.getCount() === 1 && !table.hasExtendableDep()) {

				if(list.modelForDeps && !Ext.getStore('tables').getById(tappedRec.modelName).hasIdColumn()) {
					Ext.ModelMgr.getModel(list.modelForDeps).load(tappedRec.get(list.modelForDeps.toLowerCase(), {
						success: function(record) {
	
							Ext.dispatch(Ext.apply(options, {
								controller: 'Navigator',
								action: 'createAndActivateView',
								record: record,
								tableRecord: depStore.getAt(0).get('table_id'),
								isSetView: true,
								editing: false
							}));
						}
					}));
				} else {
					Ext.dispatch(Ext.apply(options, {
						controller: 'Navigator',
						action: 'createAndActivateView',
						record: tappedRec,
						tableRecord: depStore.getAt(0).get('table_id'),
						isSetView: true,
						editing: false
					}));
				}
			}
		}
		
	},
	
	onSaveEncashButtonTap: function(options) {

		var encashStore = createStore('Encashment'),
			debtStore = options.view.debtList.store,
			updDebtArray = debtStore.getUpdatedRecords(),
			view = options.view
		;
		
		Ext.each(updDebtArray, function(debt) {
			debt.get('encashSumm') > 0 && encashStore.add(Ext.ModelMgr.create({
				isWhite: debt.get('isWhite'), datetime: new Date().format('Y-m-d H:i:s'),
				customer: view.customerRecord.getId(), debt: debt.getId(),
				summ: parseFloat(debt.get('encashSumm')).toFixed(2),
				uncashment: undefined, serverPhantom: true,
			}, 'Encashment'));
		});
		
		
		encashStore.sync();
		debtStore.sync();
		
		Ext.dispatch(Ext.apply(options, {action: 'goBack'}));
	},

	onCreateEncashRequestButtonTap: function(options) {

		var view = options.view;

		Ext.dispatch(Ext.apply(options, {
			action: 'createAndActivateView',
			editing: true,
			record: Ext.ModelMgr.create({customer: view.customerSelect.getValue(), date: getNextWorkDay(), serverPhantom: true}, 'EncashmentRequest'),
			config: {ownerViewConfig: {xtype: 'encashmentview', partnerRecord: view.partnerRecord, customerRecord: view.objectRecord, ownerViewConfig: view.ownerViewConfig}}
		}));
	},

	goBack: function(options) {

		var view = options.view;
		var newCard = Ext.create(view.ownerViewConfig);
		if (newCard.isSetView) {
			Ext.dispatch(Ext.apply(options, {action: 'loadSetViewStore', newCard: newCard, anim: IOrders.viewport.anims.back}));
		} else {
			IOrders.viewport.setActiveItem(newCard, IOrders.viewport.anims.back);
		}
	},

	onUncashButtonTap: function(options) {

		var uploadProxy = createStore('ToUpload').getProxy();

		var operCount = new Ext.data.Operation({
			filters: [{property: 'table_name', value: 'Encashment'}]
		});

		uploadProxy.count(operCount, function(operation) {

			if(operation.result === 0) {

				var view = options.view,
					encashStore = view.encashStore,
					debtStore = view.debtStore,
					formRecord = view.form.getRecord()
				;

				formRecord.save({callback: function(createdUncash) {
					
					encashStore.each(function(rec) {
						rec.set('uncashment', createdUncash.getId());
					});

					encashStore.sync();
					debtStore.sync();

					Ext.dispatch(Ext.apply(options, {action: 'goBack'}));

				}});
			} else {

				Ext.Msg.alert('Ошибка', 'Для того чтобы сдать выручку, требуется сперва передать данные об инкассациях на сервер');
				IOrders.viewport.getActiveItem().setLoading(false);
			}
		});
	},
	
	onDebtListItemSwipe: function(options) {
		var rec = options.list.getRecord(options.item),
			encashSumm = parseFloat(rec.get('encashSumm') ? rec.get('encashSumm') : '0'),
		    sign = options.event.direction === 'left' ? -1 : 1
		;
		
		Ext.dispatch (Ext.apply(options, {
			action: 'setEncashSumm',
			encashSumm: sign === 1 ? encashSumm + rec.get('remSumm') : (sign === -1 ? 0 : encashSumm),
			rec: rec
		}));
	},
	
	setEncashSumm: function(options) {
		
		var rec = options.rec,
			oldRemSumm = rec.get('remSumm'),
			oldEncashSumm = parseFloat(rec.get('encashSumm') ? rec.get('encashSumm') : '0'),
			newEncashSumm = oldRemSumm + oldEncashSumm - parseFloat(options.encashSumm) >= 0 ? options.encashSumm : oldRemSumm + oldEncashSumm
		;
		
		rec.set('encashSumm', newEncashSumm);
		rec.set('remSumm', oldRemSumm + oldEncashSumm - options.encashSumm >= 0 
				? oldRemSumm - (newEncashSumm - oldEncashSumm) 
				: 0);
	},

	updateEncashment: function(options) {

		var rec = options.rec,
			encashSumm = options.encashSumm,
			view = options.view,
			encashDebtRec = view.debtStore.getById(rec.get('debt')),
			oldEncashSumm = rec.get('summ'),
			debtRemSumm = encashDebtRec.get('remSumm')
		;

		encashSumm = oldEncashSumm + debtRemSumm >= encashSumm ? encashSumm : oldEncashSumm + debtRemSumm;
		rec.set('summ', encashSumm);

		encashDebtRec.set('encashSumm', encashSumm);
		encashDebtRec.set('remSumm', oldEncashSumm + debtRemSumm - encashSumm);

		var totalSumm = 0;
		var totalSummWhite = 0;
		
		view.encashStore.each(function(rec) {
			var encashSumm = rec.get('summ');
			totalSumm += encashSumm;
			rec.get('isWhite') && (totalSummWhite += encashSumm);
		});

		var formRecord = view.form.getRecord();
		formRecord.set('totalSumm', totalSumm);
		formRecord.set('totalSummWhite', totalSummWhite);
		
		view.form.loadRecord(formRecord);
	},

	createUncashmentView: function(options) {
		
		var oldView = IOrders.viewport.getActiveItem();
		
		var newCard = Ext.create(Ext.apply({xtype: 'uncashmentview'}, getOwnerViewConfig(oldView)));
		
		newCard.encashStore.load({limit: 0, callback: function(recs, oper) {
			var totalSumm = 0;
			var totalSummWhite = 0;
			
			Ext.each(recs, function(rec) {
				var encashSumm = rec.get('summ');
				totalSumm += encashSumm;
				rec.get('isWhite') && (totalSummWhite += encashSumm);
			});
			
			var uncashRec = Ext.ModelMgr.create({
					totalSumm: totalSumm.toFixed(2),
					totalSummWhite: totalSummWhite.toFixed(2),
					datetime: new Date().format('Y-m-d H:i:s'),
					serverPhantom: true
				}, 'Uncashment'
			);
			
			newCard.form.loadRecord(uncashRec);
			
			IOrders.viewport.setActiveItem(newCard);
		}});
	},
	
	createEncashmentView: function(options) {

		var oldView = IOrders.viewport.getActiveItem();
		var objectRecord = options.objectRecord;

		if(!options.partnerRecord) {

			Ext.ModelMgr.getModel('Partner').load(objectRecord.get('partner'), {
				success: function(partnerRecord) {
	
					var newCard = Ext.create(Ext.apply({
						xtype: 'encashmentview', partnerRecord: partnerRecord, customerRecord: objectRecord.modelName === 'Customer' ? objectRecord : undefined
					}, getOwnerViewConfig(oldView)));
					IOrders.viewport.setActiveItem(newCard);
				}
			});
		} else {

			var newCard = Ext.create(Ext.apply({
				xtype: 'encashmentview', partnerRecord: options.partnerRecord, customerRecord: customerRecord
			}, getOwnerViewConfig(oldView)));
			IOrders.viewport.setActiveItem(newCard);
		}
	},

	createAndActivateView: function(options) {
		
		var objectRecord = options.record || options.list.getRecord(options.item),
		    config = options.config || {}
		;
		
		options.tableRecord && Ext.apply(config, {
			tableRecord: options.tableRecord,
			objectRecord: objectRecord
		});
		
		var newCard = Ext.create(Ext.apply(createNavigatorView(
			objectRecord,
			IOrders.viewport.getActiveItem(),
			options.isSetView,
			options.editing,
			config
		), {isNew: objectRecord.phantom}));
		
		if (newCard.isSetView) {
			Ext.dispatch(Ext.apply(options, {action: 'loadSetViewStore', newCard: newCard}));
		} else {
			IOrders.viewport.setActiveItem(newCard);
		}
	},

	loadSetViewStore: function(options) {
		
		var oldCard = IOrders.viewport.getActiveItem(),
		    newCard = options.newCard,
		    store = newCard.setViewStore,
		    storeLimit = newCard.storeLimit,
		    storePage = newCard.storePage
		;
		
		oldCard.setLoading(true);
		
		store.currentPage = 1;
		store.clearFilter(true);
		
		var storeLoadCallback = function() {
			storePage && (store.currentPage = storePage);
			oldCard.setLoading(false);
			IOrders.viewport.setActiveItem(newCard, options.anim);
			newCard.lastSelectedRecord && Ext.dispatch(Ext.apply(options, {
				action: 'scrollToLastSelectedRecord',
				view: newCard,
				lastSelectedRecord: newCard.lastSelectedRecord,
				scrollOffset: newCard.scrollOffset
			}));
		};
		
		if (newCard.objectRecord.modelName != 'MainMenu') {
			
			if (newCard.objectRecord.modelName) {
				
				store.filters.add({property: newCard.objectRecord.modelName.toLowerCase(), value: newCard.objectRecord.getId()});
				store.load({
					limit: storeLimit,
					callback: storeLoadCallback
				});

			} else {

				store.load({
					limit: storeLimit,
					callback: storeLoadCallback
				});
				
			}
		} else {
			
			store.load({
				limit: storeLimit,
				callback: storeLoadCallback
			});
			
		}
	},
	
	scrollToLastSelectedRecord: function(options) {
		
		var lastSelectedRecord = options.lastSelectedRecord,
			view = options.view,
			list = view.down('list'),
			item = Ext.get(list.getNode(list.store.findExact('id', lastSelectedRecord.getId())))
		;
		
		item && view.form.scroller.scrollTo({
			y: options.scrollOffset.y
		});
	},
	
	onselectfieldLabelTap: function(options) {

		var field = options.field;
		var view = options.view;
		var tableRecord = view.isSetView ? view.objectRecord.modelName : field.name[0].toUpperCase() + field.name.substring(1);

		var newCard = Ext.create(createNavigatorView(view.objectRecord, IOrders.viewport.getActiveItem(),
				true, false, 
				{objectRecord: Ext.ModelMgr.create({id: 1}, 'MainMenu'), tableRecord: tableRecord}
		));
		Ext.dispatch(Ext.apply(options, {action: 'loadSetViewStore', newCard: newCard}));
	},	

	onselectfieldInputTap: function(options) {

		var field = options.field;

		Ext.ModelMgr.getModel(field.name[0].toUpperCase() + field.name.substring(1)).load(field.getValue(), {
			success: function(record) {

				var newCard = Ext.create(createNavigatorView(record, IOrders.viewport.getActiveItem(), false, false, {}));
				IOrders.viewport.setActiveItem(newCard);
			} 
		});
	},
	
	onEncashCustomerValueChange: function(options) {
		
		var view = options.view,
			selected = options.selected
		;
		
		view.customerRecord = selected;
	},

	onFilterValueChange: function(options) {
		
		var field = options.field;
		var view = options.view;
		var filterRecord = view.objectRecord;
		var store = view.setViewStore;
		
		store.clearFilter(true);
		store.currentPage = 1;
		
		var filters = [];
		options.filter && filters.push({property: filterRecord.modelName.toLowerCase(), value: field.getValue()});
		
		options.removeFilter && view.form.remove(0);
		store.filter(filters);
	},
	/**
	 * @Deprecated
	 * @param options
	 */
	onNameSelectFieldValueChange: function(options) {

		var view = options.view,
			record = options.selected,
			tableStore = Ext.getStore('tables')
		;

		view.objectRecord = record;
		view.form.loadRecord(record);

		view.depStore.loadData(getDepsData(tableStore.getById(view.objectRecord.modelName).deps(), tableStore, view));
	},

	onObjectListItemSelect: function(options) {

		var view = options.view,
			record = options.selected,
			tableStore = Ext.getStore('tables')
		;

		view.objectRecord = record;
		view.form.loadRecord(record);
	
		view.depStore.loadData(getDepsData(tableStore.getById(view.objectRecord.modelName).deps(), tableStore, view));
	},

	onSyncButtonTap: function(options) {
		options.btn.disable();
		
		IOrders.xi.upload ({
			engine: IOrders.dbeng,
			/*success: function(s) {
				Ext.Msg.alert('Загрузка завершена', 'Передано записей: '+s.getCount(),
				  function() { if (!IOrders.xi.isBusy()) options.btn.enable();}
				);
			},*/
			failure: function(s,e) {
				Ext.Msg.alert('Загрузка не удалась', e,
					function() {options.btn.enable();}
                );
			},
			recordSuccess: function(s) {
				var sb = IOrders.viewport.getActiveItem().syncButton,
					cnt = sb.cnt > 0 ? --sb.cnt : sb.cnt = null;
				
				sb.setBadge(cnt);
			}
		});
	},
	
	onPrefsButtonTap: function(options) {
		
		if (!IOrders.prefSheet)  {
			IOrders.prefSheet = Ext.create({
				xtype: 'actionsheet',
				cls: 'prefsheet',
				enter: 'right',
				items: [
					{ text: 'Закрыть панель настроек', name: 'PrefsClose'},
					{ text: 'Запросить данные', name: 'XiDownload'},
					{ text: 'Пересоздать БД', name: 'DbRebuild'},
					{ text: 'Сервер-логин', name: 'XiLogin'},
					{ text: 'Сервер-логоф', name: 'XiLogoff'},
					{ xtype: 'segmentedbutton', items: [
						{text: 'Localdata', name: 'XiNoServer', pressed: IOrders.xi.noServer},
						{text: 'System', name: 'XiYesServer', pressed: !IOrders.xi.noServer},
					]},
					{ xtype: 'segmentedbutton', layout: {align: 'none'}, items: [
						{text: 'Enable logging', name: 'EnableLog', pressed: DEBUG},
						{text: 'Disable logging', name: 'DisableLog', pressed: !DEBUG},
					]},
					{ xtype: 'segmentedbutton', layout: {align: 'none'}, items: [
 						{text: 'Новый дизайн', name: 'NewDesign', pressed: IOrders.newDesign},
 						{text: 'Старый дизайн', name: 'OldDesign', pressed: !IOrders.newDesign},
 					]},
					{ text: 'Включить Heartbeat', name: 'HeartbeatOn'},
					{ text: 'Запросить метаданные', name: 'XiMeta'},
					{ text: 'Забыть пароль', name: 'ClearLocalStorage'},
					{ text: 'Патч', name: 'ApplyPatch'},
					{ text: 'Обновить кэш', name: 'CacheRefresh'},
					{ text: 'Перезапустить', name: 'Reload'}
				],
				setDisabled: function(state) {
					var disableXi = state == true || IOrders.xi.isBusy();
					
					this.items.each (function(b) {
						if (b.name && b.name.slice(0,2) == 'Xi')
							b.setDisabled (disableXi);
					});
				}
			});
			IOrders.prefSheet.mon (
				IOrders.xi.connection,
				'beforerequest',
				function () {
					IOrders.prefSheet.setDisabled(true);
				},
				IOrders.prefSheet
			);
			IOrders.prefSheet.mon (
				IOrders.xi.connection,
				'requestcomplete',
				IOrders.prefSheet.setDisabled,
				IOrders.prefSheet, {delay: 1000}
			);
			IOrders.prefSheet.mon (
				IOrders.xi.connection,
				'requestexception',
				IOrders.prefSheet.setDisabled,
				IOrders.prefSheet, {delay: 1000}
			);
		};
		
		IOrders.prefSheet.setDisabled();
		IOrders.prefSheet.show();
		
	},

	onListSelectionChange: function(options) {
		
		var list = options.list;

		var tableRecord = undefined,
		    depStore = undefined,
		    hasIdColumn = undefined,
		    tableStore = Ext.getStore('tables')
		;
		
		Ext.each(options.selections, function(record) {
			if(!record.data.deps) {
				if(!depStore || !tableRecord) {
					var tableRecord = tableStore.getById(record.modelName),
    					hasIdColumn = tableRecord.hasIdColumn(),
    					tableRecord = !hasIdColumn && list.modelForDeps ? tableStore.getById(list.modelForDeps) : tableRecord,
    					depStore = tableRecord.deps()
                    ;
				}
				
				getDepsData(depStore, tableStore, undefined,
                    {list: list, record: record, tableRecord: tableRecord, hasIdColumn: hasIdColumn}
                );
			}
		});
	},

	onNavigatorFieldValueChange: function(options) {

		var field = options.field,
			view = options.field.up('navigatorview')
		;

		if(view) {
			if(view.objectRecord.modelName == 'SaleOrder') {

				var saleOrder = view.objectRecord;

				if(field.name == 'isBonus' && options.oldValue != undefined && view.form.recordLoaded) {

					var customerField = view.form.getComponent('formFields').getComponent('customer'),
						customerStore = customerField.store,
						customerRecord = customerStore.getById(saleOrder.get('customer') || customerField.getValue()),
						tc = saleOrder.get('totalCost'),
						bc = customerRecord.get('bonusCost')
					;

					customerRecord.set (
						'bonusCost',
						(options.newValue ? bc - tc : bc + tc).toFixed(2)
					);
					console.log(options.newValue);
					customerRecord.save();
					customerRecord.commit();
				}
			}
		}
	},

	onFacebookFeedButtonTap: function(options) {
		
		var view = options.view,
			htmlTpl = new Ext.XTemplate('<div class="fb-like-box" data-href="http://www.facebook.com/iorders"' +
					' data-width="{width}" data-height="{height}" data-show-faces="false" data-stream="true"' +
					' data-header="false"></div>');
		;
		
		IOrders.viewport.facebookFeedPanel || (IOrders.viewport.facebookFeedPanel = Ext.create({
			xtype: 'panel',
			floating: true,
			centered: true,
			layout: 'fit',
			width: view.getWidth() / 2,
			height: view.getHeight() * 2 / 3,
			html: htmlTpl.apply({width: view.getWidth() / 2 - 10, height: view.getHeight() * 2 / 3 - 10}),
			listeners: {
				hide: function () {
					Ext.destroy (IOrders.viewport.facebookFeedPanel);
					delete IOrders.viewport.facebookFeedPanel;
				}
			}
		}));
		
		IOrders.viewport.facebookFeedPanel.show();
		
		FB.init({
            appId      : '175881429178414',
            status     : true, 
            cookie     : true,
            xfbml      : true,
            oauth      : true
        });
	}
});