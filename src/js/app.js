var DEBUG = location.protocol == 'https:' ? false : localStorage.getItem('DEBUG') == 'true' ? true : false;
var oldConsoLog = console.log;

console.log = function() {
	if (DEBUG) {
		oldConsoLog.apply(this, arguments);
	}
};

applicationCache.addEventListener('updateready', function() {
	location.reload();
});


Ext.regApplication({
	name: 'IOrders',
    icon: 'src/css/apple-touch-icon.png',

//    phoneStartupScreen: 'phone_startup.png',
	
	init: function() {

		IOrders.newDesign = localStorage.getItem('newDesign') == 'true' ? true : false;

		var store = Ext.getStore('tables');
		
		createModels(store);
		createStores(store, { pageSize: 400 });
		
		IOrders.mainMenuRecord = Ext.ModelMgr.create({id: localStorage.getItem('login')}, 'MainMenu');
		
		this.viewport.setActiveItem(Ext.create({
			xtype: 'navigatorview',
			layout: 'fit',
			isObjectView: true,
			objectRecord: IOrders.mainMenuRecord
		}));
		
		this.viewport.getActiveItem().loadData();
	},
	
	launch: function() {
		
		var tStore = Ext.getStore('tables'),
			metadata = Ext.decode(localStorage.getItem('metadata')),
			vp = this.viewport = Ext.create({xtype: 'viewport'});
		;
		
		this.dbeng = new Ext.data.Engine({
			listeners: {
				dbstart: function(db) {
					console.log('Database started: version=' + db.version);
					
					tStore.getProxy().data = this.metadata;
					tStore.load(function() {IOrders.init();});
					IOrders.geoTrack();
					
				},
				fail: function() {
					localStorage.clear();
					location.reload();
				}
			}
		});
		
		IOrders.xi = new Ext.data.XmlInterface({
			view: 'iorders',
			noServer: ! (location.protocol == 'https:' || localStorage.getItem('realServer') == 'true')
		});
		
		IOrders.getMetadata = {
			success: function() {
				var me=this;
				
				me.request({
					command: 'metadata',
					success: function(response) {
						var m = response.responseXML;
						
						IOrders.viewport.setLoading(false);
						
						console.log(m);
						
						var metadata = me.xml2obj(m).metadata;
						
						localStorage.setItem('metadata', Ext.encode(metadata));
						
						IOrders.dbeng.startDatabase(metadata);
						
					}
				});
			}
		};
		
		if(!metadata) {
			
			this.viewport.setActiveItem(Ext.create({
				xtype: 'form',
				name: 'Login',
				ownSubmit: true,
				items: [
					{xtype: 'fieldset', 
						items: [
					    	{
								xtype: 'textfield', id: 'login', name: 'login', label: 'Логин',
								autoCorrect: false, autoCapitalize: false
							},
					    	{
								xtype: 'passwordfield', id: 'password', name: 'password', label: 'Пароль'
							}
						]
					},
					{xtype: 'button', text: 'Логин', name: 'Login'}
				]
			}));
			
		} else {
			
			Ext.dispatch({controller: 'Navigator', action: 'afterAppLaunch'});
			
			Ext.apply (this.xi, {
				username: localStorage.getItem('login'),
				password: localStorage.getItem('password')
			});
			
			var r = function(db) {
				IOrders.xi.login ({
					success: function() {
						if (db.clean || localStorage.getItem('needSync') == 'true'){
							localStorage.removeItem('needSync');
							IOrders.xi.download(IOrders.dbeng);
						} else {
							p = new Ext.data.SQLiteProxy({engine: IOrders.dbeng, model: 'ToUpload'});
							
							p.count(new Ext.data.Operation(),
								function(o) {
									if (o.result == 0)
										Ext.dispatch ({controller: 'Main', action: 'onXiMetaButtonTap', silent: true});
									else
										console.log ('There are unuploaded data');
								}
							);
						}
					}
				});
			}, f = function() {
				IOrders.xi.reconnect({
					success: function() {
						p = new Ext.data.SQLiteProxy({engine: IOrders.dbeng, model: 'ToUpload'});
						
						Ext.Msg.confirm ('Не удалось обновить БД', 'Проверим метаданные?', function (b) {
							if (b == 'yes')
								IOrders.xi.request( {
									command: 'logoff',
									success: function() {
										this.sessionData.id = false;
										this.login({
											success: function() {
												Ext.dispatch ({controller: 'Main', action: 'onXiMetaButtonTap'});
											}
										});
									}
								})
						});
					}
			});};
			
			
			this.dbeng.on ('dbstart', r);
			this.dbeng.on ('upgradefail', f);
			
			this.dbeng.startDatabase(metadata);
		};
		
	},
	
	
	geoTrack: function() {
		if (Ext.ModelMgr.getModel('Geolocation')) {
			
			var count = 0,
				getLocation = function () {
					if ( ++count > 6 )
						IOrders.lastCoords && saveLocation();
					else navigator.geolocation.getCurrentPosition (
						function(l) {
							
							console.log ('Geolocation success at step ' + count + ': acc=' + l.coords.accuracy);
							
							IOrders.lastCoords = l.coords;
							
							if(l.coords.accuracy < 10)
								saveLocation();
							else
								getLocation()
							;
							
						},
						function(error) {
							
							console.log( 'Geolocation error at step ' + count + ': ' + error.message + ', code: ' + error.code );
							
							if( error.code === 1 )
								Ext.Msg.alert('Геолокация запрещена',
									'iOrders нормально работать не будет. <br/><br/>'
										+ 'Зайдите в "Настройки"->"Основные"->"Сброс", нажмите "Сбросить предупр. размещения". '
										+ '<br/><br/> Затем, разрешите отслеживание местоположения.',
									function(btn) {
										count = 0;
										Ext.defer( getLocation, 2000 );
									}
								);
							else{
								if (IOrders.lastCoords) IOrders.lastCoords.errorCode = error.code;
								getLocation();
							}
						},
						{ enableHighAccuracy: true, timeout: 30000 }
					);
				},
				saveLocation = function () {
					count = 0;
					Ext.ModelMgr.create( Ext.apply( {},  IOrders.lastCoords ), 'Geolocation' ).save();
					IOrders.geoWatch = window.setTimeout( getLocation, 1000 * 60 * 5 );
				}
			;
			
			Ext.defer( getLocation, 15000 );
			
		};
	}
	
});