"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modals = void 0;
const d3 = require("d3");
exports.modals = {
    progressContext: 'free',
    open(id, reset = true) {
        if (reset)
            exports.modals.reset(id);
        if (!d3.select('#progress').classed('show'))
            if (!d3.select('#' + id).classed('show'))
                document.getElementById('trigger_' + id)?.click();
    },
    close(id) {
        document.getElementById('dismiss_' + id)?.click();
    },
    reset(id) {
        switch (id) {
            case 'add_engine_template':
                d3.select('#add_engine_template_display_name').property('value', '');
                d3.select('#add_engine_template_rigstration').property('checked', false);
                d3.select('#add_engine_template_registration_name').property('value', '').attr('disabled', '');
                d3.select('#add_engine_template_registration_code').property('value', '').attr('disabled', '');
                d3.select('#add_engine_template_confirm').attr('disabled', null);
                break;
            case 'lichess_import':
                d3.select('#li_imp_study').node().reset();
                d3.select('#li_imp_ids').node().reset();
                d3.select('#li_imp_user').node().reset();
                d3.select('#li_imp_tournament').node().reset();
                break;
            case 'condition_export':
                //d3.select('#export_conditions').selectAll('.export-condition').remove()
                break;
            case 'progress':
                exports.modals.setProgress(0, 'free');
                break;
            default:
                break;
        }
    },
    setProgress(normalized, context) {
        exports.modals.progressContext = context;
        d3.select('#progress_bar').style('width', (normalized * 100).toFixed(2) + '%');
    }
};
