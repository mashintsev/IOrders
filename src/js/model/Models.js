var createModels = function(tablesStore) {

	tablesStore.each(function(table) {
		
		var fields = [], validations = [], tableName = table.getId(),
			config = {
				fields: fields,
				modelName: tableName,
				proxy: {
					type: 'sql',
					engine: IOrders.dbeng
				},
				validations: validations
			}
		;
		
		table.columns().each(function(column) {
			
			var cName = column.get('name'),
				fieldConfig = {
					name: cName,
					type: column.get('type'),
					useNull: true,
					defaultValue: null
				}
			;
			
			if (String.right(cName, 3) == 'ing')
				fieldConfig.defaultValue = 'draft';
			
			cName == 'date'
				&& validations.push({
					type: 'length', field: cName, min: 1, message: 'обязательное для заполнения'
				})
			;
			
			cName == 'deviceCts'
				config.init = function () {
					if (!this.data['deviceCts'])
						this.data['deviceCts'] = new Date().format('Y-m-d H:i:s');
				}
			;
			
			fields.push(fieldConfig);
			
		});
		
		Ext.regModel(tableName, config);
		
		regStore(tableName);
	});

	afterCreateModels();
};

function afterCreateModels() {

	Ext.override(Ext.ModelMgr.getModel('Customer'), {
		loadFocusedBonusProgram: function(callback) {
			
			var aggOperation = new Ext.data.Operation({filters: [{property: 'customer', value: this.getId()}]});
			modelProxy.aggregate(countOperation, function(operation) {
				
				var aggResults = operation.resultSet.records[0].data;
				operation.depRec.set('stats', aggResults.cnt);
				
				if(isSetView) {
					
					config.record.data.deps = config.data;
					config.list.store && config.list.refreshNode(config.list.indexOf(config.record));
					
					config.list.doComponentLayout();
				}
			});
			
			callback && callback.call(this);
		}
	});
};

function continueLoad (store,r,s){
	if (s) {
		console.log ('Store '+store.storeId+' load success: '+r.length);
		
		if (r.length >= store.pageSize) {
			store.currentPage++;
			store.load({
				page : store.currentPage,
				start: (store.currentPage - 1) * this.pageSize,
				limit: this.pageSize,
				addRecords: true
			});
		}
	}
	else
		console.log ('Store '+store.storeId+' load failure');
}


var createStores = function(tablesStore, config) {
	
	tablesStore.each(function(table) {
		if (!(table.get('type') == 'view') && table.columns().data.map[table.getId() + 'name'] && table.deps().data.length) {
			regStore(table.getId(), Ext.apply({
				autoLoad: true,
				pageSize: 0,
				listeners: {
					load: continueLoad
				}
			}, Ext.apply(getSortersConfig(table.getId(), {}), config)));
		}
	});
	
};

var regStore = function(name, config) {
	
	Ext.regStore(name, Ext.apply({
		model: name,
		autoDestroy: false,
		remoteFilter: true,
		remoteSort: true, 
		proxy: {
			type: 'sql',
			engine: IOrders.dbeng
		}
	}, config));
	
};

var createStore = function(name, config) {

	return new Ext.data.Store(
		Ext.apply({
			remoteFilter: true,
			remoteSort: true,
			clearOnPageLoad: false,
			pageSize: 20,
			model: name,
			proxy: {
				type: 'sql',
				engine: IOrders.dbeng
			}
		}, config)
	);
};