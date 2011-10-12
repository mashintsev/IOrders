var NavigatorView = Ext.extend(AbstractView, {
	
	objectRecord: undefined,
	tableRecord: undefined,
	layout: 'fit',
	
	/**
	 * Own
	 */
	
	createItems: function() {
		
		var tablesStore = Ext.getStore('tables'),
		    table = tablesStore.getById(this.objectRecord.modelName),
		    formItems = [];
		
		if(this.isObjectView) {
			
			this.cls = 'objectView';
			this.dockedItems[0].title = table.get('name');
			
			if (this.objectRecord.modelName != 'MainMenu')
				formItems.push(createFieldSet(table.columns(), this.editable));
			
			this.dockedItems[0].items.push(
				{xtype: 'spacer'},
				{id: 'Cancel', name: 'Cancel', text: 'Отменить', hidden: true, scope: this},
				{
					id: 'SaveEdit',
					name: this.editable ? 'Save' : 'Edit',
					text: this.editable ? 'Сохранить' : 'Редактировать',
					scope: this
				}
			);
			
			if (this.objectRecord.modelName === 'MainMenu') {
				
				this.syncButton = new Ext.Button ({
					iconMask: true,
					name: 'Sync',
					iconCls: 'action',
					scope: this
				});
				
				this.dockedItems[0].items = [
					{xtype: 'spacer'},
					this.syncButton,
					{
						iconMask: true,
						name: 'Prefs',
						iconCls: 'settings',
						scope: this
					}
				];
				
				this.on ('activate', function(){
					var me = this.syncButton,
						p = new Ext.data.SQLiteProxy({
							engine: IOrders.dbeng,
							model: 'ToUpload'
						})
					;
					
					p.count(new Ext.data.Operation(), function(o) {
						if (o.wasSuccessful())
							me.setBadge(o.result);
					});
				});
				
			}
			
			if (!this.editable || this.objectRecord.modelName == 'SaleOrder')
				formItems.push(createDepsList(table.deps(), tablesStore, this));
			
		} else if (this.isSetView) {
			
			this.cls = 'setView';
			this.dockedItems[0].title = tablesStore.getById(this.tableRecord).get('nameSet');
			
			if(this.objectRecord.modelName != 'MainMenu') {
				formItems.push(createFilterField(this.objectRecord));
			}
			
			var listGroupedConfig = getGroupConfig(this.tableRecord);
			
			this.setViewStore = createStore(this.tableRecord, listGroupedConfig);
			
			formItems.push({
				xtype: 'list',
				plugins: new Ext.plugins.ListPagingPlugin({autoPaging: true}),
				scroll: false,
				cls: 'x-table-list',
				grouped: listGroupedConfig.field ? true : false,
				simpleSelect: true,
				onItemDisclosure: true,
				itemTpl: getItemTplMeta(this.tableRecord, table, this.objectRecord, listGroupedConfig.field),
				store: this.setViewStore
			});
			
			this.extendable && this.dockedItems[0].items.push({xtype: 'spacer'}, {
				ui: 'plain', iconMask: true, name: 'Add', iconCls: 'add', scope: this
			});
		}
		
		this.items = [
			this.form = new Ext.form.FormPanel({
				cls: 'x-navigator-form ' + this.cls,
				scroll: true,
				items: formItems
			})
		];
	},
	
	/**
	 * Overridden
	 */
	
	initComponent: function() {
		NavigatorView.superclass.initComponent.apply(this, arguments);
	},
	
	onShow: function() {
		NavigatorView.superclass.onShow.apply(this, arguments);
		this.form.loadRecord(this.objectRecord);
		this.isObjectView && this.form.setDisabled(!this.editable);
	}
	
});

Ext.reg('navigatorview', NavigatorView);