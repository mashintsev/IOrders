var NavigatorView = Ext.extend(AbstractView, {
	
	objectRecord: undefined,
	tableRecord: undefined,
	
	/**
	 * Own
	 */
	
	createItems: function() {
		
		var tablesStore = Ext.getStore('tables'),
		    table = tablesStore.getById(this.objectRecord.modelName),
		    formItems = [],
			me = this,
			statusesStore = Ext.getStore('statuses'),
			formConfig = {}
		;

		this.items = [];

		this.dockedItems[0].title = table.get('name');

		var sb = this.syncButton = new Ext.Button ({
			
			iconMask: true,
			name: 'Sync',
			iconCls: 'action',
			scope: this,
			
			checkDisabled: function(){
				this.setDisabled(IOrders.xi.isBusy())
			},
			
			rebadge: function(){
				var me = sb,
					p = new Ext.data.SQLiteProxy({
						engine: IOrders.dbeng,
						model: 'ToUpload'
					})
				;
				
				p.count(new Ext.data.Operation(), function(o) {
					if (o.wasSuccessful())
						me.setBadge(me.cnt = o.result);
				});
			}
			
		});
		
		sb.checkDisabled();
		
		sb.mon (
			this,
			'saved',
			sb.rebadge,
			sb
		);
		
		sb.mon (
			IOrders.xi.connection,
			'beforerequest',
			sb.setDisabled,
			sb
		);
		sb.mon (
			IOrders.xi.connection,
			'requestcomplete',
			function () {
				sb.checkDisabled();
				if (sb.getBadgeText() == '!!')
					sb.setBadge(sb.cnt);
			},
			sb, {delay: 1000}
		);
		sb.mon (
			IOrders.xi.connection,
			'requestexception',
			function () {
				sb.checkDisabled();
				sb.setBadge('!!');
			},
			sb, {delay: 1000}
		);
		
		this.dockedItems[0].items.push (this.syncButton);

		this.fbBtn = Ext.create({xtype: 'button', name: 'FacebookFeed', text: 'Новости', scope: this});
		this.dockedItems[0].items.push(this.fbBtn);

		if(this.isObjectView) {
			
			table.columns().each( function (c) {
				var cName = c.get('name');
				
				if (String.right(cName, 10) == 'processing') {
					var statusButtons = [],
						state = me.objectRecord.get(cName) || 'draft',
						btnCfg = {
							onTapStart: function() {
								
								if(!checkRecordInUpload(me.objectRecord.get('xid'))) {
									Ext.Button.prototype.onTapStart.apply(this, arguments);
									if(this.disabled) {
										Ext.Msg.alert('', 'Невозможно перейти в статус ' + this.text);
									}
								} else {
									Ext.Msg.alert('', 'Нельзя изменить статус. Запись отправляется на сервер');
								}
							}
						}
					;
					
					statusButtons =  [
						{text: 'Черновик', itemId: 'draft', name: 'draft', canEnable: function(s) { return s == 'upload'; },
							desc: 'Заказ-черновик не отправится на склад пока вы не измените его статус на "В работу"'},
						{text: 'В работу', itemId: 'upload', name: 'upload', canEnable: function(s) { return s == 'draft'; },
							desc: 'При первой же синхронизации с сервером заказ отправится на склад (если в заказе есть товары)'},
						{text: 'Проверка', itemId: 'processing', name: 'processing',
							desc: 'Заказ обрабатывается на сервере. Изменить его через iOrders уже нельзя.'},
						{text: 'На складе', itemId: 'done', name: 'done',
							desc: 'Заказ успешно принят на склад.'}
					];

					var btnPressed = undefined;
					
					statusButtons.forEach( function(b) { if (b.name) b.cls = 'make-'+b.name } );
					
					if(me.objectRecord.phantom || me.isNew) {
						state = me.saleOrderStatus || c.get('init');
					}

					if (me.objectRecord) Ext.each (statusButtons, function(b) {

						Ext.apply(b, btnCfg);
						
						b.pressed = (b.name == state);
						
						b.disabled = true;
						
						if (b.canEnable) b.disabled = !b.canEnable(state);
						
						if (b.pressed) {
							b.disabled = false;
							btnPressed = b;
						}
					});
					
					formItems.push({
						xtype: 'toolbar',
						itemId: 'statusToolbar',
						dock: 'top',
						ui: 'none',
						items:[{
							xtype: 'segmentedbutton',
							itemId: cName,
							items: statusButtons,
							name: cName, cls: 'statuses',
							listeners: {
								toggle: function (segBtn, btn, pressed) {
									pressed && segBtn.up('panel').getComponent('statusDesc').update(btn);
								},
								afterLayout: function (me) {
									me.fireEvent ('toggle', me, me.getComponent(btnPressed.name), true);
								}
							}
						}]},{
							xtype: 'panel',
							itemId: 'statusDesc',
							cls: 'statusDesc',
							tpl: '<div class="{name}">{desc}</div>'
						}
					);
				}
			});

			this.cls = 'objectView';

			formItems.push(createFieldSet(table.columns(), this.objectRecord.modelName, this));

			var spacerExist = false,
				btnLockByStatus = this.objectRecord.fields.getByKey('processing')
					&& this.objectRecord.get('processing') !== 'draft' && !this.objectRecord.get('serverPhantom')
			;
			
			if ( table.get('deletable') ) {
				
				this.dockedItems[0].items.push(
					{xtype: 'spacer'},
					{
						itemId: 'Delete',
						name: 'Delete',
						text: 'Удалить',
						scope: this,
						cls: btnLockByStatus ? 'disable' : ''
					}
				);
				
				spacerExist = true;
				
			}
			
			if(table.get('editable') || (this.editing && table.get('extendable'))) {
				
				spacerExist || this.dockedItems[0].items.push({xtype: 'spacer'});
				this.dockedItems[0].items.push(
//					{cls: 'x-hidden-display', itemId: 'Cancel', name: 'Cancel', text: 'Отменить', hidden: true, scope: this},
					{
						itemId: 'SaveEdit',
						name: this.editing ? 'Save' : 'Edit',
						text: this.editing ? 'Сохранить' : 'Редактировать',
						cls: !this.editing && btnLockByStatus ? 'disable' : '',
						scope: this
					}
				);
			}
			
			table.get('extendable') && !table.get('belongs') && this.dockedItems[0].items.push({
				itemId: 'Add', ui: 'plain', iconMask: true, name: 'Add', iconCls: 'add', scope: this, disabled: this.editing
			});
			
			if (this.objectRecord.modelName === 'MainMenu') {
				
				this.dockedItems[0].items.push (
					{xtype: 'spacer'}
				);
				
				this.dockedItems[0].items.push ({
						iconMask: true,
						name: 'Prefs',
						iconCls: 'settings',
						scope: this
				});
				
			}
			
			if (!this.editable || this.objectRecord.modelName == 'SaleOrder')
				formItems.push(createDepsList(table.deps(), tablesStore, this));

			if(IOrders.newDesign && table.hasNameColumn()) {

				var store = createStore(this.objectRecord.modelName, getSortersConfig(this.objectRecord.modelName, getSortersConfig(this.objectRecord.modelName, {})));

				var limit = 0, curPage = 1;
				if(me.ownerViewConfig.tableRecord.modelName === me.objectRecord.modelName) {

					limit = me.ownerViewConfig.storeLimit;
					curPage = me.ownerViewConfig.storePage;
				}
				store.load({limit:  limit});
				store.currentPage = curPage;

				this.items.push(me.objectList = Ext.create ({
					
					xtype: 'list',
					cls: 'sidefilter',
					flex: 1,
					plugins: limit !== 0 ? new Ext.plugins.ListPagingPlugin({autoPaging: true}) : undefined, 
					itemTpl: getItemTplMeta(this.objectRecord.modelName, {useDeps: false, onlyKey: true}).itemTpl,
					store: store,
					
					initComponent: function() {
						var scroll = this.scroll;
						Ext.List.prototype.initComponent.apply(this, arguments);
						if (typeof scroll == 'object')
							this.scroll = scroll;
					},
					
					listeners: {
						
						scope: this,
						
						refresh: function(list) {
							if(list.store.getCount() > 1) {
								
								var idx = list.store.findExact('id', this.objectRecord.getId());
								
								list.selModel.select(idx);
								
								item = Ext.fly(list.getNode(idx));
								item && list.scroller.setOffset({
									y: -item.getOffsetsTo(list.scrollEl)[1]
								});
							}
						},
						
						selectionchange: function(selModel, recs) {
							
							if(recs.length) {
								Ext.dispatch ({
									controller: 'Navigator',
									action: 'onObjectListItemSelect',
									selected: recs[0],
									view: me
								})
							}
						}
					}
				}));
			}

		} else if (this.isSetView) {
			
			this.cls = 'setView';
			this.dockedItems[0].title = tablesStore.getById(this.tableRecord).get('nameSet');
			
			if(this.objectRecord.modelName != 'MainMenu') {
				formItems.push(createFilterField(this.objectRecord));
			}
			
			var listGroupedConfig = getGroupConfig(this.tableRecord);
			var sortersConfig = getSortersConfig(this.tableRecord, listGroupedConfig);
			
			this.setViewStore = createStore(this.tableRecord, Ext.apply(listGroupedConfig, sortersConfig));
			
			formItems.push(Ext.apply({
				xtype: 'list',
				itemId: 'list',
				plugins: function (view) {
					var res = [
						new Ext.plugins.ListPagingPlugin({autoPaging: true})
					];
					
					if (me.objectRecord.modelName == 'MainMenu')
						res.push(new Ext.plugins.PullRefreshPlugin({
							isLoading: tablesStore.getById(view.tableRecord).get('loading'),
							render: function() {
								Ext.plugins.PullRefreshPlugin.prototype.render.apply(this, arguments);
								
								if(this.isLoading)
									this.setViewState('loading');
							},
							refreshFn: function(onCompleteCallback, pullPlugin) {
								this.list.pullPlugin = pullPlugin;
								IOrders.xi.fireEvent('pullrefresh', this.list.store.model.modelName, onCompleteCallback);
							}
						}));
						
					return res;
				} (this),
				scroll: false,
				cls: 'x-table-list',
				grouped: listGroupedConfig.field ? true : false,
				disableSelection: true,
				onItemDisclosure: true,
				store: this.setViewStore
			}, getItemTplMeta(this.tableRecord, {filterObject: this.objectRecord, groupField: listGroupedConfig.field})));
			
			var table = tablesStore.getById(this.tableRecord);
			
			table.get('extendable') && !table.get('belongs') && this.dockedItems[0].items.push({xtype: 'spacer'}, {
				ui: 'plain', iconMask: true, name: 'Add', iconCls: 'add', scope: this
			});
		}
		
		this.mon (this, 'activate', this.syncButton.rebadge);
		
		this.items.push(this.form = new Ext.form.FormPanel(Ext.apply({
				flex: 2,
				cls: 'x-navigator-form ' + this.cls,
				scroll: true,
				items: formItems
			}, formConfig))
		);
	},
	
	/**
	 * Overridden
	 */
	
	initComponent: function() {

		NavigatorView.superclass.initComponent.apply(this, arguments);
		this.mon (this,'show', this.loadData);
		this.addEvents ('saved');
	},
	
	loadData: function() {

		this.form.loadRecord(this.objectRecord);
		this.form.recordLoaded = true;
		this.isObjectView && this.setFieldsDisabled(!this.editing);
	},
	
	setFieldsDisabled: function(disable) {

		if(this.isObjectView) {

			var table = Ext.getStore('tables').getById(this.objectRecord.modelName),
				columnStore = table.columns(),
				fields = this.form.getFields()
			;

			Ext.iterate(fields, function(fieldName, field) {

				var column = columnStore.getById(table.getId() + fieldName);

				field.setDisabled(!column.get('editable') || disable);
			});
		}
	}
	
});

Ext.reg('navigatorview', NavigatorView);