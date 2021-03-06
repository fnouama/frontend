package common

import conf.Configuration
import conf.Configuration.environment
import dev.HttpSwitch
import layout.ContentCard
import model.{MetaData, Snap, Trail}
import org.jsoup.Jsoup
import play.api.mvc.{AnyContent, Request, RequestHeader, Result}
import play.twirl.api.Html

import scala.collection.JavaConversions._

/*
 * Builds absolute links to the core site (www.theguardian.com)
 */
trait LinkTo extends Logging {

  lazy val host = Configuration.site.host

  private val AbsoluteGuardianUrl = "^http://www.theguardian.com/(.*)$".r
  private val AbsolutePath = "^/(.+)".r
  private val RssPath = "^/(.+)(/rss)".r
  private val TagPattern = """^([\w\d-]+)/([\w\d-]+)$""".r

  val httpsEnabledSections: Seq[String] = Seq("info")

  def apply(html: Html)(implicit request: RequestHeader): String = this(html.toString(), Edition(request))
  def apply(link: String)(implicit request: RequestHeader): String = this(link, Edition(request))

  def apply(url: String, edition: Edition)(implicit request: RequestHeader): String = {
    val processedUrl: String = processUrl(url, edition, InternationalEdition.isInternationalEdition(request)).url
    handleQueryStrings(processedUrl)
  }

  def handleQueryStrings(url: String)(implicit request: RequestHeader) =
    HttpSwitch.queryString(url).trim

  case class ProcessedUrl(url: String, shouldNoFollow: Boolean = false)

  def processUrl(url: String, edition: Edition, isInternationalEdition: Boolean = false) = url match {
    case "http://www.theguardian.com" => ProcessedUrl(urlFor("", edition, isInternationalEdition))
    case "/" => ProcessedUrl(urlFor("", edition, isInternationalEdition))
    case protocolRelative if protocolRelative.startsWith("//") => ProcessedUrl(protocolRelative)
    case AbsoluteGuardianUrl(path) =>  ProcessedUrl(urlFor(path, edition))
    case "/rss" => ProcessedUrl(urlFor("", edition) + "/rss")
    case RssPath(path, format) => ProcessedUrl(urlFor(path, edition) + "/rss")
    case AbsolutePath(path) => ProcessedUrl(urlFor(path, edition))
    case otherUrl => ProcessedUrl(otherUrl, true)
  }

  def apply(trail: Trail)(implicit request: RequestHeader): Option[String] = trail match {
    case snap: Snap => snap.snapHref.filter(_.nonEmpty).map(apply(_))
    case t: Trail => Option(apply(t.url))
  }

  def apply(faciaCard: ContentCard)(implicit request: RequestHeader): String =
    faciaCard.header.url.get(request)

  private def urlFor(path: String, edition: Edition, isInternationalEdition: Boolean = false): String = {
    val editionalisedPath = Editionalise(clean(path), edition, isInternationalEdition)
    val url = s"$host/$editionalisedPath"
    url match {
      case AbsoluteGuardianUrl(_) if isHttpsEnabled(editionalisedPath) =>  url.replace("http://", "//")
      case _ => url
    }
  }

  private def isHttpsEnabled(editionalisedPath: String) = httpsEnabledSections.exists(editionalisedPath.startsWith)

  private def clean(path: String) = path match {
    case TagPattern(left, right) if left == right => left //clean section tags e.g. /books/books
    case _ => path
  }

  def redirectWithParameters(request: Request[AnyContent], realPath: String): Result = {
    val params = if (request.hasParameters) s"?${request.rawQueryString}" else ""
    Redirect(request.path.endsWith(".json") match {
      case true => s"/$realPath.json$params"
      case _ => s"/$realPath$params"
    })
  }
}

case class LinkCounts(internal: Int, external: Int) {
  def + (that: LinkCounts): LinkCounts = LinkCounts(this.internal + that.internal, this.external + that.external)
  lazy val noLinks = internal == 0 && external == 0
}

object LinkCounts {
  val None = LinkCounts(0, 0)
}

object LinkTo extends LinkTo {

  // we can assume www.theguardian.com here as this happens before any cleaning
  def countLinks(html: String): LinkCounts = {
    val links = Jsoup.parseBodyFragment(html).getElementsByTag("a").flatMap(a => Option(a.attr("href")))
    val guardianLinksCount = links.count(_ contains "www.theguardian.com")
    LinkCounts(
      internal = guardianLinksCount,
      external = links.length - guardianLinksCount
    )
  }

}

class CanonicalLink {

  import LinkTo.httpsEnabledSections

  private def isHttpsSection(r: RequestHeader) = httpsEnabledSections.exists(section => r.path.startsWith(s"/$section"))

  lazy val secureApp: Boolean = environment.secure

  def scheme(r: RequestHeader) = if (secureApp || isHttpsSection(r)) "https" else "http"

  val significantParams: Seq[String] = Seq(
    "index",
    "page"
  )

  def apply(implicit request: RequestHeader): String = {
    val queryString = {
      val q = significantParams.flatMap(key => request.getQueryString(key).map(value => s"$key=${value.urlEncoded}"))
        .sorted.mkString("&")
      if (q.isEmpty) "" else s"?$q"
    }
    s"${scheme(request)}://${request.host}${request.path}$queryString"
  }
}

object CanonicalLink extends CanonicalLink

object AnalyticsHost extends implicits.Requests {
  def apply()(implicit request: RequestHeader): String =
    if (request.isSecure) "https://hits-secure.theguardian.com" else "http://hits.theguardian.com"
}

