import { setting } from 'discourse/lib/computed';
import DiscourseURL from "discourse/lib/url";
import computed from "ember-addons/ember-computed-decorators";
import AdminDashboardNext from "admin/models/admin-dashboard-next";
import Report from "admin/models/report";
import VersionCheck from 'admin/models/version-check';

const PROBLEMS_CHECK_MINUTES = 1;

export default Ember.Controller.extend({
  queryParams: ["period"],
  period: "monthly",
  isLoading: false,
  dashboardFetchedAt: null,
  exceptionController: Ember.inject.controller("exception"),
  showVersionChecks: setting('version_checks'),
  diskSpace: Ember.computed.alias("model.attributes.disk_space"),

  availablePeriods: ["yearly", "quarterly", "monthly", "weekly"],

  @computed('problems.length')
  foundProblems(problemsLength) {
    return this.currentUser.get('admin') && (problemsLength || 0) > 0;
  },


  @computed('foundProblems')
  thereWereProblems(foundProblems) {
    if (!this.currentUser.get('admin')) { return false; }

    if (foundProblems) {
      this.set('hadProblems', true);
      return true;
    } else {
      return this.get('hadProblems') || false;
    }
  },

  fetchDashboard() {
    if (this.get("isLoading")) return;

    if (!this.get("dashboardFetchedAt") || moment().subtract(30, "minutes").toDate() > this.get("dashboardFetchedAt")) {
      this.set("isLoading", true);

      const versionChecks = this.siteSettings.version_checks;

      AdminDashboardNext.find().then(adminDashboardNextModel => {

        if (versionChecks) {
          this.set('versionCheck', VersionCheck.create(adminDashboardNextModel.version_check));
        }

        this.setProperties({
          dashboardFetchedAt: new Date(),
          model: adminDashboardNextModel,
          reports: adminDashboardNextModel.reports.map(x => Report.create(x))
        });
      }).catch(e => {
        this.get("exceptionController").set("thrown", e.jqXHR);
        this.replaceRoute("exception");
      }).finally(() => {
        this.set("isLoading", false);
      });
    }

    if (!this.get('problemsFetchedAt') || moment().subtract(PROBLEMS_CHECK_MINUTES, 'minutes').toDate() > this.get('problemsFetchedAt')) {
      this.loadProblems();
    }
  },

  loadProblems() {
    this.set('loadingProblems', true);
    this.set('problemsFetchedAt', new Date());
    AdminDashboardNext.fetchProblems().then(d => {
      this.set('problems', d.problems);
    }).finally(() => {
      this.set('loadingProblems', false);
    });
  },

  @computed('problemsFetchedAt')
  problemsTimestamp(problemsFetchedAt) {
    return moment(problemsFetchedAt).format('LLL');
  },

  @computed("period")
  startDate(period) {
    let fullDay = moment().utc().subtract(1, "day");

    switch (period) {
      case "yearly":
        return fullDay.subtract(1, "year").startOf("day");
        break;
      case "quarterly":
        return fullDay.subtract(3, "month").startOf("day");
        break;
      case "weekly":
        return fullDay.subtract(1, "week").startOf("day");
        break;
      case "monthly":
        return fullDay.subtract(1, "month").startOf("day");
        break;
      default:
        return null;
    }
  },

  @computed()
  lastWeek() {
    return moment().utc().endOf("day").subtract(1, "week");
  },

  @computed()
  endDate() {
    return moment().utc().subtract(1, "day").endOf("day");
  },

  @computed("updated_at")
  updatedTimestamp(updatedAt) {
    return moment(updatedAt).format("LLL");
  },

  @computed("last_backup_taken_at")
  backupTimestamp(lastBackupTakenAt) {
    return moment(lastBackupTakenAt).format("LLL");
  },

  actions: {
    changePeriod(period) {
      DiscourseURL.routeTo(this._reportsForPeriodURL(period));
    },
    refreshProblems() {
      this.loadProblems();
    },
  },

  _reportsForPeriodURL(period) {
    return `/admin/dashboard-next?period=${period}`;
  }
});
