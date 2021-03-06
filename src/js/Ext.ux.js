Ext.override(Ext.Interaction, {controller: 'Main'});

/**
 * Scope указывает на панель, в которой лежит кнопка
 */
Ext.override(Ext.Button, {
	handler: function(btn, e) {

		Ext.dispatch({action: 'onButtonTap', view: this, btn: btn, event: e});
	}
});

Ext.override(Ext.form.Select, {

	onListSelect: function(selModel, selected) {
        if (selected) {
            this.setValue(selected.get(this.valueField));
            this.fireEvent('change', this, this.getValue());
        }
        
        this.listPanel.hide({
            type: 'fade',
            out: true,
            scope: this
        });
        
        Ext.dispatch({
        	action: 'onSelectFieldValueChange',
        	field: this,
        	selected: selected,
        	filter: true
        });
    },

	onRender: function(){
        Ext.form.Select.superclass.onRender.apply(this, arguments);
        
        var name = this.hiddenName;
        if (name) {
            this.hiddenField = this.el.insertSibling({
                name: name,
                tag: 'input',
                type: 'hidden'
            }, 'after');
        }
        
        this.onFieldLabelTap && this.mon(this.labelEl,'tap', function(evt, el, o) {
        	Ext.dispatch({
        		action: 'onFieldLabelTap',
        		field: this
        	});
        }, this);
    },

    onMaskTap: function() {
        if (this.onFieldInputTap && this.disabled) {
        	Ext.dispatch({
        		action: 'onFieldInputTap',
        		field: this
        	});
            return;
        }
        
        this.showComponent();
    },

	setItemTplWithTitle: function() {

		var list = this.listPanel.getComponent('list'),
			table = Ext.getStore('tables').getById(this.store.model.prototype.modelName),
			titleColumns = table.getTitleColumns()
		;

		list.itemTpl = ['<div class="x-list-label">{' + this.displayField + '}</div>'];
		titleColumns.each(function(col) {list.itemTpl.push('<div>{' + col.get('name') + '}</div>');});
		list.itemTpl.push('<span class="x-list-selected"></span>');

		list.tpl = '<tpl for="."><div class="x-list-item ' + list.itemCls + '"><div class="x-list-item-body">' + list.itemTpl.join('') + '</div>';
		list.tpl += '</div></tpl>';
		list.tpl = new Ext.XTemplate(list.tpl);
	}
});

Ext.override(Ext.form.Toggle, {
	setValue: function(value) {
	
		value = (value === true || value === 1 ? 1 : 0);
		Ext.form.Toggle.superclass.setValue.call(this, value, this.animationDuration);
	
		var fieldEl = this.fieldEl;
	
		if(this.constrain(value) === this.minValue) {
			fieldEl.addCls(this.minValueCls);
			fieldEl.removeCls(this.maxValueCls);
		} else {
			fieldEl.addCls(this.maxValueCls);
			fieldEl.removeCls(this.minValueCls);
		}
	}
});




Ext.override(Ext.form.FormPanel, {
	getElConfig: function() {
		return Ext.apply(Ext.form.FormPanel.superclass.getElConfig.call(this), {
			tag: 'div'
		});
	},
	listeners: {
		beforesubmit: function(form, values, options) {
			
			if(form.ownSubmit) {
				Ext.dispatch({
					action: 'onBeforeSubmitForm',
					form: form,
					values: values,
					opt: options
				});
				return false;
			}
			return true;
		}
	}
});

Ext.override ( Ext.util.Observable, {
	
	clearManagedListeners : function() {
        var managedListeners = this.managedListeners || [],
            ln = managedListeners.length,
            i, managedListener;
		
        for (i = 0; i < ln; i++) {
            managedListener = managedListeners[i];
            managedListener.item.un(managedListener.ename, managedListener.fn, managedListener.scope);
        }
		
        this.managedListeners = [];
    }

});

Ext.override (Ext.SegmentedButton, {
	
	onTap : function(e, t) {
		if (!this.disabled && (t = e.getTarget('.x-button'))) {
			var b = Ext.getCmp(t.id),
				allowPress = true
			;
			b.wasPressed = b.pressed;

			if(this.allowMultiple) {
				var pressed = this.getPressed();
	
				Ext.each(pressed, function(btn) {
	
					Ext.each(btn.disallowOther, function(dBtn) {
						allowPress = allowPress && dBtn != b.itemId;
					});
				});
			}
			if (!b.disabled && allowPress) this.setPressed(b.itemId || t.id, this.allowDepress ? undefined : true);
		}
	},
	
	afterLayout : function(layout) {
        var me = this;
        
        Ext.SegmentedButton.superclass.afterLayout.call(me, layout);
		
        if (!me.initialized) {
            me.items.each(function(item, index) {
                item.disabled || me.setPressed(item, !!item.pressed, true); 
            });
            if (me.allowMultiple) {
                me.pressedButtons = me.getPressedButtons();
            }
            me.initialized = true;
        }
    }
});

Ext.override(Ext.List, {

	onIndex : function(record, target, index) {
        var key = record.get('key').toLowerCase(),
            groups = this.store.getGroups(),
            ln = groups.length,
            group, i, closest, id;

        groups.sort(function(a, b) {
        	var o1 = a.name.toLowerCase(),
        		o2 = b.name.toLowerCase()
        	;
        	return o1 == o2 ? 0 : (o1 > o2 ? 1: -1);
        });
        for (i = 0; i < ln; i++) {
            group = groups[i];
            id = this.getGroupId(group);

            if (id == key || id > key) {
                closest = id;
                break;
            }
            else {
                closest = id;
            }
        }

        closest = this.getTargetEl().down('.x-group-' + id.replace('.', '\\.'));
        if (closest) {
            this.scroller.scrollTo({x: 0, y: closest.getOffsetsTo(this.scrollEl)[1]}, 400);
        }
        return closest;
    },

	listeners: {
		/*selectionchange: function(selModel, selections) {
			Ext.dispatch({action: 'onListSelectionChange', list: this, selModel: selModel, selections: selections});
		},*/
		itemtap: function(list, idx, item, e) {
			Ext.dispatch({action: 'onListItemTap', list: list, idx: idx, item: item, event: e});
		},
		disclose: function(rec, item, idx, e) {
			Ext.dispatch({action: 'onListItemDisclosure', list: this, idx: idx, item: item, event: e});
		},
		update: function() {

			this.scroller && this.scroller.updateBoundary();
		}
	},

	onUpdate : function(store, record) {

		this.itemRefresh = true;
		Ext.List.superclass.onUpdate.apply(this, arguments);
		this.itemRefresh = false;
	},

	bufferRender : function(records, index){
		var div = document.createElement('div');

		if (this.grouped && this.itemRefresh && records.length == 1) {
			this.listItemTpl.overwrite (div, Ext.List.superclass.collectData.call(this, records, index));
		} else {
			this.tpl.overwrite(div, this.collectData(records, index));
		}

		return Ext.query(this.itemSelector, div);
	}
});

String.right = function (str, n){
    if (n <= 0)
       return "";
    else if (n > String(str).length)
       return str;
    else {
       var iLen = String(str).length;
       return String(str).substring(iLen, iLen - n);
    }
};

Ext.MessageBox.YESNO[1].text = 'Да';
Ext.MessageBox.YESNO[0].text = 'Нет';
Ext.Picker.prototype.doneButton = 'OK';
Ext.Picker.prototype.cancelButton = 'Отмена';